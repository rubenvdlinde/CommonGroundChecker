#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Conduction <info@conduction.nl>
# SPDX-License-Identifier: EUPL-1.2
"""Raw open-track measures of one repository, as JSON.

The checker runs this script to rate a repository on the open track, and
scripts/open-benchmark runs it on every benchmark repository to derive the
open-track thresholds, so both read the code the same way.

Scope and unit reading are those of the maintainability estimate
(scripts/maintainability/check_maintainability.py): the same production files
(tests, generated and third-party code left out) and the same lizard 1.24.3
reader with its workarounds. What differs is the output: per language a
histogram of unit LOC per metric value, so thresholds can be derived from it
and any threshold can be applied to it later.

  measure.py <repo> [--json OUT] [--jscpd PATH]

With --jscpd (jscpd 5), duplication is measured as well: one jscpd run per
language over that language's production files, 6 lines and 30 tokens, weak
mode, and jscpd's own duplicated and total line counts.

Exit status: 0 measured, 2 usage or tool error, 4 no file in a supported
language in scope.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True  # keep __pycache__ out of the checked-out scripts
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "maintainability"))
import check_maintainability as cm  # noqa: E402

SCHEMA = 1
JSCPD_ARGS = ["--min-lines", "6", "--min-tokens", "30", "--mode", "weak"]
NOTHING_TO_MEASURE = 4
METRICS = {"unit_size": "nloc", "unit_complexity": "ccn", "unit_interfacing": "params"}


def histogram(units, key):
    """{metric value: summed unit LOC}, keys as strings in ascending order."""
    loc = {}
    for unit in units:
        loc[unit[key]] = loc.get(unit[key], 0) + unit["nloc"]
    return {str(value): loc[value] for value in sorted(loc)}


def jscpd_version(exe):
    p = subprocess.run([exe, "--version"], capture_output=True, text=True)
    return (p.stdout or p.stderr).strip().split()[-1] if p.returncode == 0 else None


def duplication(app, exe, files):
    """jscpd's own line counts for one language's files: {lines, duplicated_lines}.
    The files are copied into an empty directory so jscpd sees nothing else."""
    stage = tempfile.mkdtemp(prefix="open-track-jscpd-")
    try:
        src = os.path.join(stage, "src")
        for rel in files:
            target = os.path.join(src, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copyfile(os.path.join(app, rel), target)
        out = os.path.join(stage, "out")
        p = subprocess.run([exe, *JSCPD_ARGS, "--reporters", "json", "--output", out, src],
                           capture_output=True, text=True)
        report = os.path.join(out, "jscpd-report.json")
        if not os.path.isfile(report):
            raise RuntimeError(f"jscpd exited {p.returncode} without a report: {(p.stderr or p.stdout).strip()[-300:]}")
        with open(report) as fh:
            total = json.load(fh)["statistics"]["total"]
        return {"lines": total["lines"], "duplicated_lines": total["duplicatedLines"]}
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def measure(app, jscpd=None):
    lizard, error = cm.load_lizard()
    if lizard is None:
        raise RuntimeError(error)
    files = cm.production_files(app, cm.Scope(app))
    reader = cm.UnitReader(lizard)
    by_lang = {}
    code_loc = {}
    for rel, lang in sorted(files.items()):
        text = cm.read_text(os.path.join(app, rel))
        by_lang.setdefault(lang, []).extend(reader.units(rel, lang, text))
        code_loc[lang] = code_loc.get(lang, 0) + len(cm.code_lines(text, lang))
    languages = {}
    for lang in sorted(set(files.values())):
        units = by_lang.get(lang, [])
        entry = {
            "files": sum(1 for value in files.values() if value == lang),
            "code_loc": code_loc.get(lang, 0),
            "units": len(units),
            "unit_loc": sum(u["nloc"] for u in units),
        }
        for prop, key in METRICS.items():
            entry[prop] = histogram(units, key)
        if jscpd:
            entry["duplication"] = duplication(app, jscpd, [f for f, lg in files.items() if lg == lang])
        languages[lang] = entry
    return {
        "schema": SCHEMA,
        "head": (cm.git(app, "rev-parse", "HEAD")[1] or "").strip() or None,
        "tools": {"lizard": cm.LIZARD_VERSION, "jscpd": jscpd_version(jscpd) if jscpd else None},
        "files": len(files),
        "skipped_files": reader.skipped,
        "languages": languages,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Raw open-track measures of one repository.")
    parser.add_argument("repo")
    parser.add_argument("--json", help="write the measures here instead of stdout")
    parser.add_argument("--jscpd", help="jscpd 5 executable; duplication is measured only when given")
    args = parser.parse_args(argv)
    try:
        result = measure(os.path.abspath(args.repo), args.jscpd)
    except RuntimeError as e:
        print(f"open-track: {e}", file=sys.stderr)
        return 2
    text = json.dumps(result, indent=1, sort_keys=True)
    if args.json:
        with open(args.json, "w") as fh:
            fh.write(text + "\n")
    else:
        print(text)
    return 0 if result["files"] else NOTHING_TO_MEASURE


if __name__ == "__main__":
    sys.exit(main())
