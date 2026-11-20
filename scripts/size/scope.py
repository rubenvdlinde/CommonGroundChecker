#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Conduction <info@conduction.nl>
# SPDX-License-Identifier: EUPL-1.2
"""Lists the production files of a repository for the size measure.

The scope is the one of the maintainability estimate: tracked files, minus
Sigrid's default excludes (generated, vendored and third-party code, database
migrations), minus the Nextcloud build output js/ and l10n/, minus the
`exclude:` patterns of a sigrid.yaml at the root, minus test code. On top of
the estimate's languages it keeps HTML, templates, style sheets and SQL, which
count towards the size of a system but are not rated for maintainability.

Usage: scope.py <repository>   prints a JSON array of repo-relative paths.
"""
import importlib.util
import json
import os
import sys

SIZE_EXTENSIONS = {
    ".php", ".py", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue",
    ".html", ".htm", ".twig", ".css", ".scss", ".sass", ".less", ".sql",
}


def load_estimate():
    sys.dont_write_bytecode = True
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "maintainability", "check_maintainability.py")
    spec = importlib.util.spec_from_file_location("check_maintainability", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def production_files(app, estimate):
    scope = estimate.Scope(app)
    out = []
    for rel in estimate.tracked_files(app):
        if os.path.splitext(rel)[1].lower() not in SIZE_EXTENSIONS:
            continue
        probe = "/" + rel
        if any(p.fullmatch(probe) for p in scope.exclude) or any(p.fullmatch(probe) for p in scope.tests):
            continue
        if os.path.isfile(os.path.join(app, rel)):
            out.append(rel)
    return sorted(out)


def main(argv):
    if len(argv) != 1 or not os.path.isdir(argv[0]):
        print("usage: scope.py <repository>", file=sys.stderr)
        return 2
    json.dump(production_files(argv[0], load_estimate()), sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
