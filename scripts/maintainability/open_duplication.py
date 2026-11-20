#!/usr/bin/env python3
# SPDX-License-Identifier: EUPL-1.2
"""Open-track duplication: jscpd's own duplicated-lines percentage, per
language and overall, over the production code the maintainability estimate
rates.

This script belongs to the checker; it is not vendored. It reads the scope
(Sigrid default excludes, test code, js/ and l10n/ left out) from the vendored
check_maintainability.py next to it, so both tracks measure the same files.

jscpd runs once per language with --min-lines 6 --min-tokens 30 --mode weak:
token clones of at least 6 lines and 30 tokens, comments and whitespace
ignored. Its percentage is duplicated lines over all lines of the files it
read, which is not SIG's definition (redundant code lines); the result is
labelled "jscpd duplicated lines" and is informative only.

A language whose jscpd run grows beyond OPEN_DUPLICATION_MAX_MEMORY_MB
(default 2560) is stopped and reported as not measured, and the overall
percentage is then left out.

Usage:
    open_duplication.py <app-dir> --json FILE

Environment:
    OPEN_DUPLICATION_JSCPD          jscpd binary to run instead of the pinned one
    OPEN_DUPLICATION_MAX_MEMORY_MB  memory cap per jscpd run
    HYDRA_GATE_TOOLS_DIR            where the pinned jscpd is installed

Exit status: 0 a report was written, 4 nothing to judge, 5 jscpd is unavailable.
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_maintainability as estimate  # noqa: E402

JSCPD_VERSION = "5.4.2"
MIN_LINES = 6
MIN_TOKENS = 30
MODE = "weak"
LARGEST_CLONES = 10
NOTHING_TO_JUDGE = 4
TOOL_UNAVAILABLE = 5


def max_memory_kb():
    return int(os.environ.get("OPEN_DUPLICATION_MAX_MEMORY_MB") or 2560) * 1024


def find_jscpd():
    """Path to the jscpd binary at the pinned version, or (None, reason).

    The npm package is a node wrapper around a native binary; the binary is
    run directly so its memory can be watched."""
    exe = os.environ.get("OPEN_DUPLICATION_JSCPD")
    if not exe:
        target = os.path.join(estimate.tools_dir(), f"jscpd-{JSCPD_VERSION}", "node_modules")
        found = sorted(glob.glob(os.path.join(target, "jscpd-*", "bin", "jscpd")))
        if not found:
            return None, f"jscpd {JSCPD_VERSION} is not installed under {target}"
        exe = found[0]
    if not os.path.isfile(exe):
        return None, f"{exe} does not exist"
    p = subprocess.run([exe, "--version"], capture_output=True, text=True)
    version = ((p.stdout or "").strip().splitlines()[-1:] or ["?"])[0]
    if version.split()[-1:] != [JSCPD_VERSION]:
        return None, f"{exe} reports {version!r}, not the pinned jscpd {JSCPD_VERSION}"
    return exe, None


def rss_kb(pid):
    try:
        with open(f"/proc/{pid}/status") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1])
    except OSError:
        pass
    return 0


def run_jscpd(app, exe, files, cap_kb):
    """jscpd's JSON report for `files` (repo-relative), or (None, reason)."""
    out_dir = tempfile.mkdtemp(prefix="open-dup-")
    try:
        cmd = [exe, "--silent", "--absolute", "--reporters", "json", "--output", out_dir,
               "--min-lines", str(MIN_LINES), "--min-tokens", str(MIN_TOKENS), "--mode", MODE, *files]
        with tempfile.TemporaryFile() as err:
            proc = subprocess.Popen(cmd, cwd=app, stdout=subprocess.DEVNULL, stderr=err)
            while proc.poll() is None:
                if rss_kb(proc.pid) > cap_kb:
                    proc.kill()
                    proc.wait()
                    return None, f"jscpd needed more than {cap_kb // 1024} MB"
                time.sleep(0.2)
            err.seek(0)
            stderr = err.read().decode(errors="replace").strip()
        report = os.path.join(out_dir, "jscpd-report.json")
        if not os.path.isfile(report):
            return None, f"jscpd exited {proc.returncode} without a report: {stderr[-300:]}"
        with open(report) as fh:
            return json.load(fh), None
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def percentage(duplicated, lines):
    return round(100 * duplicated / lines, 2) if lines else 0.0


def clone_rows(app, language, data):
    """One row per clone pair, paths relative to `app`. jscpd's line count
    belongs to the first fragment; in a Vue file the second fragment's range
    can be shorter."""
    rows = []
    for d in data.get("duplicates", []):
        a, b = d["firstFile"], d["secondFile"]
        rows.append({
            "language": language,
            "file": os.path.relpath(os.path.join(app, a["name"]), app),
            "startLine": a["start"], "endLine": a["end"],
            "otherFile": os.path.relpath(os.path.join(app, b["name"]), app),
            "otherStartLine": b["start"], "otherEndLine": b["end"],
            "lines": d["lines"],
        })
    return rows


def build_report(app, files, exe, cap_kb):
    """The open-track report over `files` ({rel path: language})."""
    by_lang = {}
    for rel, lang in sorted(files.items()):
        by_lang.setdefault(lang, []).append(rel)
    report = {
        "tool": "jscpd", "version": JSCPD_VERSION,
        "settings": {"minLines": MIN_LINES, "minTokens": MIN_TOKENS, "mode": MODE},
        "files": len(files), "languages": {}, "overall": None, "largestClones": [],
    }
    clones = []
    for lang, rels in sorted(by_lang.items()):
        data, why = run_jscpd(app, exe, rels, cap_kb)
        if data is None:
            report["languages"][lang] = {"files": len(rels), "notMeasured": why}
            continue
        total = data.get("statistics", {}).get("total", {})
        lines, duplicated = total.get("lines", 0), total.get("duplicatedLines", 0)
        report["languages"][lang] = {
            "files": len(rels), "sources": total.get("sources", 0), "lines": lines,
            "duplicatedLines": duplicated, "clones": total.get("clones", 0),
            "percentage": percentage(duplicated, lines),
        }
        clones.extend(clone_rows(app, lang, data))
    measured = [v for v in report["languages"].values() if "notMeasured" not in v]
    if measured and len(measured) == len(report["languages"]):
        lines = sum(v["lines"] for v in measured)
        duplicated = sum(v["duplicatedLines"] for v in measured)
        report["overall"] = {"lines": lines, "duplicatedLines": duplicated,
                             "percentage": percentage(duplicated, lines)}
    clones.sort(key=lambda c: (-c["lines"], c["file"], c["startLine"]))
    report["largestClones"] = clones[:LARGEST_CLONES]
    return report


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("app")
    ap.add_argument("--json", required=True)
    args = ap.parse_args(argv)
    app = os.path.abspath(args.app)
    files = estimate.production_files(app, estimate.Scope(app))
    if not files:
        return NOTHING_TO_JUDGE
    exe, why = find_jscpd()
    if not exe:
        print(why, file=sys.stderr)
        return TOOL_UNAVAILABLE
    report = build_report(app, files, exe, max_memory_kb())
    with open(args.json, "w") as fh:
        json.dump(report, fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
