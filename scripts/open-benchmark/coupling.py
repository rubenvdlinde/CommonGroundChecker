#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Conduction <info@conduction.nl>
# SPDX-License-Identifier: EUPL-1.2
"""Coupling measures of one benchmark repository.

  coupling.py <repo> --json OUT [--time-limit SECONDS]

Runs check_coupling.py (a copy of scripts/coupling/check_coupling.py of the
coupling check, feat/open-track-coupling db1cde2) and adds, per language, the
histogram the open-track thresholds are derived from: `fanInHistogram`, the
code lines of the modules per fan-in (distinct depending modules).
"""

import collections
import importlib.util
import os
import sys

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    "check_coupling", os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_coupling.py"))
cc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cc)

_score = cc.score


def score(loc, edges):
    result = _score(loc, edges)
    incoming = collections.defaultdict(set)
    for s, t in edges:
        if s != t and s in loc and t in loc:
            incoming[t].add(s)
    histogram = collections.Counter()
    for module, lines in loc.items():
        histogram[len(incoming[module])] += lines
    result["moduleCoupling"]["fanInHistogram"] = {str(k): histogram[k] for k in sorted(histogram)}
    return result


cc.score = score

if __name__ == "__main__":
    sys.exit(cc.main())
