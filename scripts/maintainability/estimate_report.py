#!/usr/bin/env python3
# SPDX-License-Identifier: EUPL-1.2
"""The maintainability estimate's report, with Simian as its duplication
cross-check.

This script belongs to the checker; it is not vendored. It builds the report
with the vendored check_maintainability.py next to it, without that script's
jscpd 4 cross-check, and adds "duplication_simian" to each language.

The estimate's own duplication (duplication_profile(), windows of 6 code lines
equal modulo whitespace, copies minus one) stays the rating source. The
cross-check runs Simian 4.2.1 in strict mode (no case folding, curly braces
and modifiers kept) once per language, then counts, for every copy after the
first of a clone set, the code lines that are equal to the first copy without
whitespace; a copy counts when at least 6 of its lines do. Simian has no Vue
support, so Vue gets no cross-check. A Simian that is missing or runs out of
its heap leaves the cross-check out with the reason; the estimate still runs.

Usage:
    estimate_report.py <app-dir> --json FILE [--profile four-star|five-star]

Environment:
    SIMIAN_JAR     Simian jar to run instead of the pinned one
    SIMIAN_JAVA    java executable (default: java on PATH)
    SIMIAN_HEAP    maximum Java heap (default 2g)

Exit status: 0 a report was written, 2 an unknown profile, 4 nothing to
judge (the report is still written), 5 lizard is unavailable.
"""
import argparse
import collections
import json
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_maintainability as estimate  # noqa: E402

SIMIAN_VERSION = "4.2.1"
SIMIAN_STRICT = ["-threshold=6", "-ignoreCurlyBraces-", "-ignoreIdentifierCase-", "-ignoreStringCase-",
                 "-ignoreCharacterCase-", "-ignoreModifiers-", "-failOnDuplication-"]
SIMIAN_LANGUAGES = ("php", "python", "javascript", "typescript")
NOTHING_TO_JUDGE = 4
TOOL_UNAVAILABLE = 5


def find_simian():
    """(java, jar), or (None, reason)."""
    jar = os.environ.get("SIMIAN_JAR") or os.path.join(
        estimate.tools_dir(), f"simian-{SIMIAN_VERSION}", f"simian-{SIMIAN_VERSION}.jar")
    if not os.path.isfile(jar):
        return None, f"Simian {SIMIAN_VERSION} is not installed at {jar}"
    java = os.environ.get("SIMIAN_JAVA") or shutil.which("java")
    if not java:
        return None, "java is not on PATH, so Simian cannot run"
    return (java, jar), None


def run_simian(app, simian, files):
    """Clone sets among `files` (repo-relative), each a list of (file, start, end), or (None, reason)."""
    java, jar = simian
    out_dir = tempfile.mkdtemp(prefix="estimate-simian-")
    try:
        xml_path = os.path.join(out_dir, "simian.xml")
        heap = os.environ.get("SIMIAN_HEAP") or "2g"
        cmd = [java, f"-Xmx{heap}", "-jar", jar, *SIMIAN_STRICT, f"-formatter=xml:{xml_path}", *files]
        p = subprocess.run(cmd, cwd=app, capture_output=True, text=True, errors="replace")
        if "OutOfMemoryError" in (p.stderr or "") + (p.stdout or ""):
            return None, f"Simian ran out of its {heap} heap"
        if not os.path.isfile(xml_path) or not os.path.getsize(xml_path):
            return None, f"Simian exited {p.returncode} without a report: {(p.stderr or p.stdout).strip()[-300:]}"
        root = ET.parse(xml_path).getroot()
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)
    if root.get("version") != SIMIAN_VERSION:
        return None, f"Simian reports version {root.get('version')}, not the pinned {SIMIAN_VERSION}"
    sets = []
    for s in root.iter("set"):
        blocks = [(os.path.relpath(os.path.join(app, b.get("sourceFile")), app),
                   int(b.get("startLineNumber")), int(b.get("endLineNumber"))) for b in s.iter("block")]
        sets.append(sorted(blocks))
    return sets, None


def literal_redundant(app, sets, lang):
    """{file: redundant line numbers}: per clone set, the code lines of every
    copy after the first that equal the first copy's lines without whitespace,
    for copies with at least 6 such lines."""
    text, code = {}, {}

    def lines_of(rel):
        if rel not in text:
            raw = estimate.read_text(os.path.join(app, rel))
            text[rel] = raw.splitlines()
            code[rel] = estimate.code_lines(raw, lang)
        return text[rel], code[rel]

    def squeeze(line):
        return "".join(line.split())

    redundant = collections.defaultdict(set)
    for blocks in sets:
        first, start, end = blocks[0]
        first_text, first_code = lines_of(first)
        reference = [n for n in range(start, end + 1) if n in first_code]
        for rel, s, e in blocks[1:]:
            other_text, other_code = lines_of(rel)
            copy = [n for n in range(s, e + 1) if n in other_code]
            same = {nb for na, nb in zip(reference, copy)
                    if squeeze(first_text[na - 1]) == squeeze(other_text[nb - 1])}
            if len(same) >= estimate.DUP_MIN_LINES:
                redundant[rel] |= same
    return redundant


def cross_check(app, simian, files, lang, code_lines):
    """The duplication_simian row of one language."""
    if lang not in SIMIAN_LANGUAGES:
        return {"notMeasured": "Simian has no support for this language"}
    if isinstance(simian, str):
        return {"notMeasured": simian}
    sets, why = run_simian(app, simian, files)
    if sets is None:
        return {"notMeasured": why}
    redundant = sum(len(v) for v in literal_redundant(app, sets, lang).values())
    share = round(redundant / code_lines, 4) if code_lines else 0.0
    return {"code_lines": code_lines, "redundant_lines": redundant, "share": share,
            "stars": estimate.stars_of("duplication", share), "clone_sets": len(sets)}


def build_report(app, lizard, simian, profile):
    """The vendored report without jscpd, plus the Simian cross-check per
    language. `simian` is (java, jar) or the reason it is unavailable."""
    report = estimate.build_report(app, lizard, None, profile)
    report["tools"]["simian"] = SIMIAN_VERSION if not isinstance(simian, str) else None
    files = estimate.production_files(app, estimate.Scope(app))
    for lang, row in report["languages"].items():
        rels = sorted(f for f, lg in files.items() if lg == lang)
        code_lines = (row.get("duplication") or {}).get("code_lines", 0)
        row["duplication_simian"] = cross_check(app, simian, rels, lang, code_lines)
    return report


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("app")
    ap.add_argument("--json", required=True)
    ap.add_argument("--profile", default=os.environ.get("HYDRA_GATE_SIG_PROFILE") or estimate.DEFAULT_PROFILE)
    args = ap.parse_args(argv)
    if args.profile not in estimate.PROFILES:
        print(f"unknown profile '{args.profile}'; choose one of {', '.join(estimate.PROFILES)}", file=sys.stderr)
        return 2
    lizard, why = estimate.load_lizard()
    if not lizard:
        print(why, file=sys.stderr)
        return TOOL_UNAVAILABLE
    simian, why = find_simian()
    report = build_report(os.path.abspath(args.app), lizard, simian or why, args.profile)
    with open(args.json, "w") as fh:
        json.dump(report, fh, indent=1)
    return 0 if report["files"] else NOTHING_TO_JUDGE


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
