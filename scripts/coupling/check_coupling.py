#!/usr/bin/env python3
"""Open-track coupling measure: module and component structure per language.

One scorer over a module dependency graph per language, each graph produced by
an open-source tool:

    php         pdepend (--dependency-xml), run in batches of directories
    python      grimp, plus import-linter when the repository declares contracts
    javascript  dependency-cruiser over JavaScript, TypeScript and Vue files

A module is one source file in the production scope of the maintainability
estimate (scripts/maintainability), and its size is the estimate's code-line
count. Components are directories, found by the estimate's 80% rule. Per
language the report gives the module and edge counts, component independence,
component entanglement (violation degree and density), the module-coupling risk
profile (share of code per fan-in band) and the dependency cycles.

The values are raw measurements: no stars, no thresholds. A language whose tool
is missing, fails or runs out of memory is reported as not measured, with the
reason.

usage: check_coupling.py <repo> --json <out.json> [--time-limit SECONDS]
Exit status 0 when written, 4 when no file in a supported language is in scope.
"""
import argparse
import collections
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ESTIMATE = os.path.join(HERE, "..", "maintainability", "check_maintainability.py")
_spec = importlib.util.spec_from_file_location("check_maintainability", ESTIMATE)
sig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sig)

REPORT_VERSION = 1
NOTHING_TO_MEASURE = 4
PDEPEND_VERSION = "3.0.0"
DEPCRUISE_VERSION = "17.4.3"
GRIMP_VERSION = "3.18"
IMPORT_LINTER_VERSION = "2.15"

TOOLS_DIR = os.environ.get("COUPLING_TOOLS_DIR") or os.environ.get("HYDRA_GATE_TOOLS_DIR") or "/opt/analysis-tools"
# Wall-clock seconds every tool run together may take; set from --time-limit.
DEADLINE = {"at": None, "seconds": None}
# pdepend holds every parsed file in memory and resolves references across all
# of them, so one run over 7,800 files peaks near 2.7 GB. Batches of directories
# keep each run small; references to classes outside a batch keep their name and
# resolve through the class map of the whole scope.
PHP_BATCH_FILES = int(os.environ.get("COUPLING_PHP_BATCH_FILES", "1000"))
PHP_MEMORY_MB = int(os.environ.get("COUPLING_PHP_MEMORY_MB", "1536"))

LANGUAGE_GROUP = {"php": "php", "python": "python", "javascript": "javascript", "typescript": "javascript",
                  "vue": "javascript"}
FAN_IN_BANDS = ("low", "moderate", "high", "veryHigh")
JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".json"]


class NotMeasured(Exception):
    """A language whose graph could not be built; the message is the reason."""


# --------------------------------------------------------------------------
# scorer
# --------------------------------------------------------------------------

def strongly_connected(nodes, adj):
    """Strongly connected groups of more than one node (iterative Tarjan)."""
    index, low, on_stack, stack, groups = {}, {}, set(), [], []
    counter = 0
    for start in nodes:
        if start in index:
            continue
        work = [(start, iter(sorted(adj.get(start, ()))))]
        index[start] = low[start] = counter
        counter += 1
        stack.append(start)
        on_stack.add(start)
        while work:
            node, children = work[-1]
            child = next(children, None)
            if child is not None:
                if child not in index:
                    index[child] = low[child] = counter
                    counter += 1
                    stack.append(child)
                    on_stack.add(child)
                    work.append((child, iter(sorted(adj.get(child, ())))))
                elif child in on_stack:
                    low[node] = min(low[node], index[child])
                continue
            work.pop()
            if work:
                low[work[-1][0]] = min(low[work[-1][0]], low[node])
            if low[node] == index[node]:
                group = []
                while True:
                    member = stack.pop()
                    on_stack.discard(member)
                    group.append(member)
                    if member == node:
                        break
                if len(group) > 1:
                    groups.append(sorted(group))
    return groups


def fan_in_band(fan_in, bounds):
    for name, bound in zip(FAN_IN_BANDS, bounds):
        if fan_in <= bound:
            return name
    return FAN_IN_BANDS[-1]


def score(loc, edges):
    """The coupling measurements of one language from {module: code lines} and
    a set of (source, target) module pairs. Fan-in counts distinct depending
    modules; a component line between two components weighs the module pairs
    on it, as in the maintainability estimate."""
    modules = sorted(loc)
    edges = {(s, t) for s, t in edges if s != t and s in loc and t in loc}
    total = sum(loc.values()) or 1
    incoming = collections.defaultdict(set)
    outgoing = collections.defaultdict(set)
    for s, t in edges:
        incoming[t].add(s)
        outgoing[s].add(t)

    bounds = sig.BOUNDS["module_coupling"]
    band_loc = collections.Counter({band: 0 for band in FAN_IN_BANDS})
    histogram = collections.Counter()
    for m in modules:
        band_loc[fan_in_band(len(incoming[m]), bounds)] += loc[m]
        histogram[len(incoming[m])] += loc[m]
    above = [round(sum(loc[m] for m in modules if len(incoming[m]) > b) / total, 4) for b in bounds]

    root, comp = sig.component_of_factory(modules)
    comp_loc = collections.Counter()
    for m in modules:
        comp_loc[comp(m)] += loc[m]
    hidden = sum(loc[m] for m in modules if all(comp(s) == comp(m) for s in incoming[m]))
    lines = collections.Counter()
    for s, t in edges:
        if comp(s) != comp(t):
            lines[(comp(s), comp(t))] += 1
    connected = {c for pair in lines for c in pair}
    degree, kinds, _examples = sig.violation_degree(dict(lines))

    module_cycles = strongly_connected(modules, outgoing)
    comp_adj = collections.defaultdict(set)
    for a, b in lines:
        comp_adj[a].add(b)
    component_cycles = strongly_connected(sorted(comp_loc), comp_adj)
    in_cycles = [m for group in module_cycles for m in group]

    return {
        "modules": len(modules),
        "edges": len(edges),
        "loc": sum(loc.values()),
        "componentDefinition": f"directories below {root or '.'}/ (a level is descended while one directory holds "
                               "more than 80% of the modules)",
        "components": len(comp_loc),
        "componentIndependence": round(hidden / total, 4),
        "componentEntanglement": {
            "violationDegree": round(degree, 4),
            "density": round(len(lines) / max(len(connected), 1), 2),
            "communicationLines": len(lines),
            "violations": kinds,
        },
        "moduleCoupling": {
            "bounds": list(bounds),
            "riskProfile": {band: round(band_loc[band] / total, 4) for band in FAN_IN_BANDS},
            "above": above,
            "fanInHistogram": {str(k): histogram[k] for k in sorted(histogram)},
            "highestFanIn": [{"module": m, "fanIn": len(incoming[m])}
                             for m in sorted(modules, key=lambda m: (-len(incoming[m]), m))[:5]],
        },
        "cycles": {
            "moduleCycles": len(module_cycles),
            "modulesInCycles": len(in_cycles),
            "locShareInCycles": round(sum(loc[m] for m in in_cycles) / total, 4),
            "largestModuleCycle": max((len(g) for g in module_cycles), default=0),
            "componentCycles": len(component_cycles),
            "largestComponentCycle": max((len(g) for g in component_cycles), default=0),
        },
    }


# --------------------------------------------------------------------------
# tools
# --------------------------------------------------------------------------

def run(cmd, cwd, env=None):
    """Runs one tool within what is left of the time limit."""
    timeout = None
    if DEADLINE["at"] is not None:
        timeout = DEADLINE["at"] - time.monotonic()
        if timeout <= 0:
            raise NotMeasured(f"the time limit of {DEADLINE['seconds']} seconds was used up by earlier tools")
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, errors="replace",
                              timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        raise NotMeasured(f"{os.path.basename(cmd[0])} did not finish within the time limit of "
                          f"{DEADLINE['seconds']} seconds")
    except OSError as error:
        raise NotMeasured(f"{os.path.basename(cmd[0])} could not start: {error}")


def tail(text, lines=2):
    return " ".join(text.strip().splitlines()[-lines:])[:300]


def php_roots(app, files):
    """The PSR-4 autoload directories of composer.json that hold measured
    files, or None when it declares none."""
    path = os.path.join(app, "composer.json")
    try:
        with open(path, encoding="utf-8") as fh:
            psr4 = json.load(fh).get("autoload", {}).get("psr-4", {})
    except (OSError, ValueError, AttributeError):
        return None
    roots = set()
    for dirs in psr4.values() if isinstance(psr4, dict) else []:
        for d in dirs if isinstance(dirs, list) else [dirs]:
            if isinstance(d, str):
                d = d.strip("/")
                d = "" if d == "." else d[2:] if d.startswith("./") else d
                if any(not d or f.startswith(d + "/") for f in files):
                    roots.add(d)
    if "" in roots:
        return None
    return sorted(r for r in roots if not any(r.startswith(o + "/") for o in roots if o != r)) or None


def php_batches(files, limit):
    """Lists of paths (directories or files) that each hold at most `limit` of
    `files`; a directory over the limit is split into its subdirectories and
    its own files."""
    def split(prefix, members):
        if len(members) <= limit:
            return [(prefix, len(members))]
        units, children = [], collections.defaultdict(list)
        for f in members:
            rest = f[len(prefix) + 1:]
            if "/" in rest:
                children[rest.split("/")[0]].append(f)
            else:
                units.append((f, 1))
        for child in sorted(children):
            units.extend(split(f"{prefix}/{child}", children[child]))
        return units

    tops = collections.defaultdict(list)
    units = []
    for f in files:
        if "/" in f:
            tops[f.split("/")[0]].append(f)
        else:
            units.append((f, 1))
    for top in sorted(tops):
        units.extend(split(top, tops[top]))
    batches, current, size = [], [], 0
    for path, count in units:
        if current and size + count > limit:
            batches.append(current)
            current, size = [], 0
        current.append(path)
        size += count
    if current:
        batches.append(current)
    return batches


CLASS_DECL = re.compile(r"^\s*(?:(?:abstract|final|readonly)\s+)*(?:class|interface|trait|enum)\s+([A-Za-z_]\w*)", re.M)
NAMESPACE_DECL = re.compile(r"^\s*namespace\s+([^;{\s]+)", re.M)


def php_class_map(app, files):
    """{fully qualified class name: file} for the classes, interfaces, traits
    and enums the files declare."""
    out = {}
    for rel in files:
        src = sig.read_text(os.path.join(app, rel))
        m = NAMESPACE_DECL.search(src)
        ns = m.group(1).strip("\\") + "\\" if m else ""
        for name in CLASS_DECL.findall(src):
            out.setdefault(ns + name, rel)
    return out


def find_pdepend():
    phar = os.path.join(TOOLS_DIR, f"pdepend-{PDEPEND_VERSION}", "pdepend.phar")
    if os.path.isfile(phar) and shutil.which("php"):
        return ["php", f"-dmemory_limit={PHP_MEMORY_MB}M", phar]
    exe = shutil.which("pdepend")
    return [exe] if exe else None


def php_graph(app, files):
    cmd = find_pdepend()
    if not cmd:
        raise NotMeasured(f"pdepend {PDEPEND_VERSION} is not installed")
    roots = php_roots(app, files)
    measured = sorted(f for f in files if not roots or any(f.startswith(r + "/") for r in roots))
    if not measured:
        raise NotMeasured("no PHP file under the PSR-4 autoload directories of composer.json")
    class_map = php_class_map(app, measured)
    real_app = os.path.realpath(app)
    edges = set()
    batches = php_batches(measured, PHP_BATCH_FILES)
    with tempfile.TemporaryDirectory(prefix="coupling-pdepend-") as tmp:
        for i, batch in enumerate(batches):
            xml_path = os.path.join(tmp, f"deps-{i}.xml")
            p = run([*cmd, "--quiet", "--without-annotations", "--suffix=php", f"--dependency-xml={xml_path}",
                     ",".join(batch)], cwd=app, env={**os.environ, "HOME": tmp})
            if "Allowed memory size" in p.stdout + p.stderr:
                raise NotMeasured(f"pdepend needed more than {PHP_MEMORY_MB} MB on a batch of "
                                  f"{PHP_BATCH_FILES} files or fewer")
            if p.returncode != 0 or not os.path.isfile(xml_path):
                raise NotMeasured(f"pdepend failed (exit {p.returncode}): {tail(p.stdout + p.stderr)}")
            for el in ET.parse(xml_path).getroot().iter():
                file_el = el.find("file")
                if el.tag not in ("class", "interface", "trait", "enum") or file_el is None:
                    continue
                src = os.path.relpath(os.path.realpath(file_el.get("name", "")), real_app)
                efferent = el.find("efferent")
                for ref in efferent if efferent is not None else []:
                    ns = ref.get("namespace") or ""
                    target = class_map.get(f"{ns}\\{ref.get('name')}" if ns else ref.get("name"))
                    if target:
                        edges.add((src, target))
    note = f"{len(measured)} files under {', '.join(r + '/' for r in roots)} (composer.json PSR-4)" if roots else None
    return measured, edges, f"pdepend {PDEPEND_VERSION}", note, {"batches": len(batches)}


def python_packages(app, files):
    """{top-level package: directory that holds it} for the measured Python
    files that sit in a regular package (a directory with __init__.py)."""
    packages = {}
    for rel in files:
        d = os.path.dirname(rel)
        top = None
        while d and os.path.isfile(os.path.join(app, d, "__init__.py")):
            top = d
            d = os.path.dirname(d)
        if top:
            packages.setdefault(os.path.basename(top), os.path.dirname(top))
    return packages


def module_file(root, module):
    base = os.path.join(root, *module.split(".")) if root else os.path.join(*module.split("."))
    return base + ".py", os.path.join(base, "__init__.py")


def python_graph(app, files):
    try:
        import grimp
    except ImportError:
        raise NotMeasured(f"grimp {GRIMP_VERSION} is not installed")
    packages = python_packages(app, files)
    if not packages:
        raise NotMeasured("no Python file sits in a package (a directory with __init__.py)")
    real_app = os.path.realpath(app)
    roots = sorted({os.path.join(real_app, r) if r else real_app for r in packages.values()})
    for r in roots:
        if r not in sys.path:
            sys.path.append(r)
    usable, shadowed = {}, []
    for name, root in sorted(packages.items()):
        try:
            found = importlib.util.find_spec(name)
        except (ImportError, ValueError):
            found = None
        expected = os.path.join(real_app, root, name)
        locations = list(found.submodule_search_locations or []) if found else []
        if any(os.path.realpath(loc) == expected for loc in locations):
            usable[name] = root
        else:
            shadowed.append(name)
    if not usable:
        raise NotMeasured("every package name is shadowed by an installed package: " + ", ".join(shadowed))
    try:
        graph = grimp.build_graph(*sorted(usable), include_external_packages=False, cache_dir=None)
    except Exception as error:  # grimp reports syntax errors and unreadable files as exceptions
        raise NotMeasured(f"grimp could not build the import graph: {str(error)[:300]}")
    known = set(files)

    def path_of(module):
        root = usable[module.split(".")[0]]
        for candidate in module_file(root, module):
            if candidate in known:
                return candidate
        return None

    edges = set()
    for module in graph.modules:
        src = path_of(module)
        if not src:
            continue
        for imported in graph.find_modules_directly_imported_by(module):
            dst = path_of(imported)
            if dst:
                edges.add((src, dst))
    note = "packages " + ", ".join(sorted(usable))
    if shadowed:
        note += "; left out, shadowed by an installed package: " + ", ".join(shadowed)
    return sorted(files), edges, f"grimp {GRIMP_VERSION}", note, {"contracts": import_contracts(app, roots)}


def import_linter_config(app):
    for name, marker in ((".importlinter", "[importlinter]"), ("setup.cfg", "[importlinter]"),
                         ("pyproject.toml", "[tool.importlinter]")):
        path = os.path.join(app, name)
        if os.path.isfile(path) and marker in sig.read_text(path):
            return path
    return None


CONTRACTS_LINE = re.compile(r"Contracts:\s*(\d+)\s*kept,\s*(\d+)\s*broken")
IMPORT_LINTER_RUNNER = (
    "import sys\n"
    "sys.path.extend(sys.argv[2:])\n"
    "from importlinter.cli import lint_imports_command\n"
    "sys.argv = ['lint-imports', '--no-cache', '--config', sys.argv[1]]\n"
    "lint_imports_command()\n"
)


def import_contracts(app, roots):
    """The repository's own import-linter contracts: {"kept", "broken"}, or
    {"error"} when they could not be checked; None when none are declared."""
    config = import_linter_config(app)
    if not config:
        return None
    if re.search(r"^\s*contract_types\s*=", sig.read_text(config), re.M):
        return {"error": "the configuration loads contract types from the repository, which is not run"}
    with tempfile.TemporaryDirectory(prefix="coupling-importlinter-") as tmp:
        try:
            p = run([sys.executable, "-I", "-c", IMPORT_LINTER_RUNNER, os.path.realpath(config), *roots], cwd=tmp,
                    env={**os.environ, "HOME": tmp})
        except NotMeasured as error:
            return {"error": str(error)}
    m = CONTRACTS_LINE.search(p.stdout)
    if not m:
        return {"error": f"import-linter {IMPORT_LINTER_VERSION} gave no result: {tail(p.stdout + p.stderr)}"}
    return {"kept": int(m.group(1)), "broken": int(m.group(2))}


def find_depcruise():
    exe = os.path.join(TOOLS_DIR, f"dependency-cruiser-{DEPCRUISE_VERSION}", "node_modules", ".bin", "depcruise")
    if os.path.isfile(exe):
        return exe
    return shutil.which("depcruise")


def read_jsonc(path):
    text = sig.read_text(path)
    text = re.sub(r'("(?:\\.|[^"\\])*")|/\*.*?\*/|//[^\n]*', lambda m: m.group(1) or "", text, flags=re.S)
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    try:
        return json.loads(text)
    except ValueError:
        return None


def js_aliases(app, files):
    """Import aliases from the `paths` of tsconfig.json or jsconfig.json, plus
    `@` for the directory that holds the JavaScript modules when it is not
    declared. The repository's own bundler configuration is never run."""
    aliases = {}
    for name in ("tsconfig.json", "jsconfig.json"):
        data = read_jsonc(os.path.join(app, name)) if os.path.isfile(os.path.join(app, name)) else None
        options = data.get("compilerOptions", {}) if isinstance(data, dict) else {}
        base = options.get("baseUrl", ".") if isinstance(options.get("baseUrl", "."), str) else "."
        for key, targets in (options.get("paths") or {}).items():
            if isinstance(targets, list) and targets and isinstance(targets[0], str):
                alias = key[:-2] if key.endswith("/*") else key
                target = targets[0][:-2] if targets[0].endswith("/*") else targets[0]
                aliases.setdefault(alias, os.path.normpath(os.path.join(app, base, target)))
    if "@" not in aliases:
        root, _comp = sig.component_of_factory(sorted(files))
        aliases["@"] = os.path.join(app, root) if root else app
    return aliases


def is_local(specifier, aliases):
    """Whether an import names a file of the repository rather than a package."""
    return specifier.startswith((".", "/")) or any(specifier == a or specifier.startswith(a + "/") for a in aliases)


def js_graph(app, files):
    exe = find_depcruise()
    if not exe:
        raise NotMeasured(f"dependency-cruiser {DEPCRUISE_VERSION} is not installed")
    real_app = os.path.realpath(app)
    with tempfile.TemporaryDirectory(prefix="coupling-depcruise-") as tmp:
        resolver = os.path.join(tmp, "resolve.cjs")
        aliases = {k: os.path.realpath(v) for k, v in js_aliases(real_app, files).items()}
        with open(resolver, "w", encoding="utf-8") as fh:
            fh.write("module.exports = " + json.dumps({"resolve": {"alias": aliases, "extensions": JS_EXTENSIONS}}))
        out_path = os.path.join(tmp, "out.json")
        p = run([exe, "--no-config", "--output-type", "json", "--output-to", out_path, "--do-not-follow",
                 "node_modules", "--webpack-config", resolver, *sorted(files)], cwd=real_app,
                env={**os.environ, "HOME": tmp})
        if p.returncode != 0 or not os.path.isfile(out_path):
            raise NotMeasured(f"dependency-cruiser failed (exit {p.returncode}): {tail(p.stdout + p.stderr)}")
        with open(out_path, encoding="utf-8") as fh:
            data = json.load(fh)
    known = set(files)
    edges, unresolved = set(), 0
    for module in data.get("modules", []):
        src = module.get("source")
        if src not in known:
            continue
        for dep in module.get("dependencies", []):
            if "type-only" in dep.get("dependencyTypes", []):
                continue
            target = dep.get("resolved")
            if target in known:
                edges.add((src, target))
            elif dep.get("couldNotResolve") and is_local(dep.get("module", ""), aliases):
                unresolved += 1
    return sorted(files), edges, f"dependency-cruiser {DEPCRUISE_VERSION}", None, {"unresolvedLocalImports": unresolved}


GRAPHS = {"php": php_graph, "python": python_graph, "javascript": js_graph}


def measure(app):
    files = sig.production_files(app, sig.Scope(app))
    groups = collections.defaultdict(list)
    for rel, lang in files.items():
        if lang in LANGUAGE_GROUP:
            groups[LANGUAGE_GROUP[lang]].append(rel)
    report = {"version": REPORT_VERSION, "languages": {}}
    for group in ("php", "python", "javascript"):
        members = sorted(groups.get(group, []))
        if not members:
            continue
        try:
            modules, edges, tool, note, extra = GRAPHS[group](app, members)
        except NotMeasured as reason:
            report["languages"][group] = {"measured": False, "reason": str(reason), "files": len(members)}
            continue
        loc = {m: len(sig.code_lines(sig.read_text(os.path.join(app, m)), files[m])) for m in modules}
        entry = {"measured": True, "tool": tool}
        if note:
            entry["scope"] = note
        entry.update(score(loc, edges))
        entry.update(extra)
        report["languages"][group] = entry
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("repo")
    parser.add_argument("--json", required=True)
    parser.add_argument("--time-limit", type=int, help="seconds all tool runs together may take")
    args = parser.parse_args()
    if args.time_limit:
        DEADLINE.update(at=time.monotonic() + args.time_limit, seconds=args.time_limit)
    report = measure(args.repo)
    with open(args.json, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1)
    return 0 if report["languages"] else NOTHING_TO_MEASURE


if __name__ == "__main__":
    sys.exit(main())
