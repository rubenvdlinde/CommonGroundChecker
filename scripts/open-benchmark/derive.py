#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Conduction <info@conduction.nl>
# SPDX-License-Identifier: EUPL-1.2
"""Derive the open-track thresholds from the benchmark measures.

  derive.py <work dir> --date YYYY-MM-DD [--candidates candidates.json] [--out-dir DIR] [--thresholds-dir DIR]

Reads <work dir>/measures/*.json (written by run.py) and writes:
  * <thresholds-dir>/thresholds-<date>.json, the thresholds the checker rates with;
  * <out-dir>/benchmark.json and benchmark.csv, the repositories they come from.

Method:
  1. Benchmark: a measured repository counts when it has at least MIN_CODE_LOC
     code lines in scope. At most MAX_PER_OWNER repositories of one owner count,
     the ones with the most GitHub stars first, then the largest.
  2. Risk thresholds (Alves, Ypma and Visser 2010): per unit metric, every unit
     weighs its LOC as a share of its repository's unit LOC, and every
     repository weighs the same (section IV, steps 1 to 6). The thresholds are
     the metric values at 70, 80 and 90 percent of that weighted distribution,
     80, 90 and 95 for unit interfacing (Table IV). A unit above the first is
     moderate risk, above the second high, above the third very high.
  3. Star limits (Alves, Correia and Visser 2011, Algorithm 1 in section III-A):
     the limits per star level on the cumulative risk shares are searched so
     that the benchmark is spread over 5 to 1 stars as 5/30/30/30/5 percent.
     A repository's stars follow section III-B1. Duplication is calibrated the
     same way with one share.
  4. Coupling, from <work dir>/coupling/*.json (run.py --coupling-image): module
     coupling as a risk profile over the fan-in histogram (steps 2 and 3),
     component independence (higher is better) and entanglement (lower is
     better) as single shares (step 3). A repository with a language its
     coupling tool did not measure is left out of these three properties.
All languages of a repository are pooled.
"""

import argparse
import csv
import glob
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIN_CODE_LOC = 2000
MAX_PER_OWNER = 12
# Alves, Ypma and Visser 2010, Table IV: 70/80/90% of the code, and 80/90/95% for unit interfacing.
RISK_QUANTILES = {"unit_size": (0.70, 0.80, 0.90), "unit_complexity": (0.70, 0.80, 0.90),
                  "unit_interfacing": (0.80, 0.90, 0.95), "module_coupling": (0.70, 0.80, 0.90)}
# Share of the benchmark per star level, best first: 5/30/30/30/5 percent.
DISTRIBUTION = {5: 0.05, 4: 0.30, 3: 0.30, 2: 0.30, 1: 0.05}
RISK_PROPERTIES = {
    "unit_size": "unit size in lines of code (lizard NLOC)",
    "unit_complexity": "McCabe cyclomatic complexity per unit (lizard CCN)",
    "unit_interfacing": "parameters per unit (lizard)",
}


def owner(name):
    return name.split("/")[0]


def pooled(measures):
    """One repository's languages added up: {code_loc, unit_loc, histograms, duplication}."""
    out = {"code_loc": 0, "unit_loc": 0, "lines": 0, "duplicated_lines": 0, "languages": {}}
    hist = {prop: {} for prop in RISK_PROPERTIES}
    measured_dup = False
    for lang, entry in measures["languages"].items():
        out["code_loc"] += entry["code_loc"]
        out["unit_loc"] += entry["unit_loc"]
        out["languages"][lang] = entry["code_loc"]
        for prop in RISK_PROPERTIES:
            for value, loc in entry[prop].items():
                hist[prop][int(value)] = hist[prop].get(int(value), 0) + loc
        if entry.get("duplication"):
            measured_dup = True
            out["lines"] += entry["duplication"]["lines"]
            out["duplicated_lines"] += entry["duplication"]["duplicated_lines"]
    out["histograms"] = hist
    out["duplication"] = out["duplicated_lines"] / out["lines"] if measured_dup and out["lines"] else None
    return out


def select(repos, candidates):
    """The benchmark: big enough, and at most MAX_PER_OWNER per owner."""
    stars = {c["name"]: c.get("stars", 0) for c in candidates}
    big = [r for r in repos if r["pooled"]["code_loc"] >= MIN_CODE_LOC and r["pooled"]["unit_loc"] > 0]
    big.sort(key=lambda r: (owner(r["name"]).lower(), -stars.get(r["name"], 0), -r["pooled"]["code_loc"], r["name"]))
    kept, per_owner, capped = [], {}, []
    for r in big:
        n = per_owner.get(owner(r["name"]), 0)
        if n >= MAX_PER_OWNER:
            capped.append(r["name"])
            continue
        per_owner[owner(r["name"])] = n + 1
        kept.append(r)
    small = sorted(r["name"] for r in repos if r not in big)
    return sorted(kept, key=lambda r: r["name"].lower()), small, capped


def risk_thresholds(histograms, quantiles):
    """Metric values at the `quantiles` points of the LOC-weighted distribution
    of {metric value: LOC} histograms, one per repository, in which every
    repository weighs the same; each bound at least one above the previous one."""
    weights = {}
    for hist in histograms:
        total = sum(hist.values())
        for value, loc in hist.items():
            weights[value] = weights.get(value, 0.0) + loc / total / len(histograms)
    bounds, cumulative, values = [], 0.0, sorted(weights)
    targets = list(quantiles)
    for value in values:
        cumulative += weights[value]
        while targets and cumulative >= targets[0] - 1e-12:
            bounds.append(value)
            targets.pop(0)
    while targets:
        bounds.append(values[-1])
        targets.pop(0)
    for i in range(1, len(bounds)):
        bounds[i] = max(bounds[i], bounds[i - 1] + 1)
    return bounds


def profile(hist, bounds):
    """Share of the histogram's LOC strictly above each bound."""
    total = sum(hist.values())
    return [sum(loc for value, loc in hist.items() if value > bound) / total for bound in bounds]


def pooled_coupling(c):
    """One repository's coupling over its languages, or (None, reason) when a
    language was not measured: the fan-in histogram added up, and component
    independence and entanglement averaged with each language's code lines."""
    if c is None:
        return None, "no coupling measures"
    if c.get("error"):
        return None, c["error"]
    langs = c.get("languages") or {}
    failed = {lang: e.get("reason") for lang, e in langs.items() if not e.get("measured")}
    if failed:
        return None, "; ".join(f"{lang}: {reason}" for lang, reason in sorted(failed.items()))
    if not langs:
        return None, "no language with a coupling tool in scope"
    hist, loc, independence, entanglement = {}, 0, 0.0, 0.0
    for e in langs.values():
        for value, lines in e["moduleCoupling"]["fanInHistogram"].items():
            hist[int(value)] = hist.get(int(value), 0) + lines
        loc += e["loc"]
        independence += e["componentIndependence"] * e["loc"]
        entanglement += e["componentEntanglement"]["violationDegree"] * e["loc"]
    if loc <= 0:
        return None, "no code lines in the measured modules"
    tools = sorted({e["tool"] for e in langs.values()})
    return {"histogram": hist, "independence": independence / loc, "entanglement": entanglement / loc,
            "tools": tools}, None


def ceil4(x):
    return math.ceil(x * 10000 - 1e-9) / 10000


def rate(values, limits):
    """Alves, Correia and Visser 2011, section III-B1: per share the strictest
    level whose limit it stays within (1 star when it exceeds them all), and the
    rating is the lowest of those. `limits` is {level: [limit per share]}."""
    levels = sorted(limits, reverse=True)
    per_share = [next((lvl for lvl in levels if v <= limits[lvl][i]), 1) for i, v in enumerate(values)]
    return min(per_share)


def calibrate(profiles):
    """Alves, Correia and Visser 2011, Algorithm 1: for each star level, best
    first, step through the sorted shares with one common index until enough
    repositories rate at that level or better, then lower each share's limit as
    far as that still holds. "Enough" is the cumulative partition: the number of
    repositories DISTRIBUTION puts at this level or better. Profiles are tuples
    of cumulative shares; returns {level: [limit per share]}."""
    n, width = len(profiles), len(profiles[0])
    ordered = [sorted(ceil4(p[k]) for p in profiles) for k in range(width)]
    levels = [lvl for lvl in sorted(DISTRIBUTION, reverse=True) if lvl > 1]
    limits, cumulative = {}, 0.0

    def enough(trial, needed):
        return sum(1 for p in profiles if rate(p, trial) >= level) >= needed

    for level in levels:
        cumulative += DISTRIBUTION[level]
        needed = round(cumulative * n)
        i = -1
        while True:
            i += 1
            limits[level] = [ordered[k][i] for k in range(width)]
            if enough(limits, needed) or i >= n - 1:
                break
        for k in range(width):
            j = i
            while j > 0:
                trial = {**limits, level: [*limits[level]]}
                trial[level][k] = ordered[k][j - 1]
                if not enough(trial, needed):
                    break
                limits[level] = trial[level]
                j -= 1
    return limits


def spread(stars):
    return {str(lvl): round(sum(1 for s in stars if s == lvl) / len(stars), 3) for lvl in (5, 4, 3, 2, 1)}


def reason(r, candidate):
    langs = ", ".join(f"{lang} {loc}" for lang, loc in sorted(r["pooled"]["languages"].items(), key=lambda kv: -kv[1]))
    return (f"{'; '.join(candidate.get('sources', []))}; licence {candidate.get('licence') or 'unknown'}; "
            f"{r['pooled']['code_loc']} code lines in scope ({langs})")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Derive the open-track thresholds from the benchmark measures.")
    parser.add_argument("work")
    parser.add_argument("--date", required=True)
    parser.add_argument("--candidates", default=os.path.join(HERE, "candidates.json"))
    parser.add_argument("--out-dir", default=HERE)
    parser.add_argument("--thresholds-dir", default=os.path.join(HERE, "..", "..", "src", "lib", "openModel"))
    args = parser.parse_args(argv)

    with open(args.candidates) as fh:
        candidates = json.load(fh)["candidates"]
    by_name = {c["name"]: c for c in candidates}
    repos = []
    for path in sorted(glob.glob(os.path.join(args.work, "measures", "*.json"))):
        with open(path) as fh:
            m = json.load(fh)
        coupling_path = os.path.join(args.work, "coupling", os.path.basename(path))
        coupling = None
        if os.path.isfile(coupling_path):
            with open(coupling_path) as fh:
                coupling = json.load(fh)
        repos.append({"name": m["name"], "url": m["url"], "commit": m["head"], "tools": m["tools"], "pooled": pooled(m),
                      "coupling": pooled_coupling(coupling)})
    bench, small, capped = select(repos, candidates)
    if len(bench) < 10:
        print(f"only {len(bench)} repositories qualify; need at least 10", file=sys.stderr)
        return 2
    tools = sorted({json.dumps(r["tools"], sort_keys=True) for r in bench})
    if len(tools) != 1:
        print(f"the benchmark was measured with different tool versions: {tools}", file=sys.stderr)
        return 2

    properties, measured = {}, {r["name"]: {} for r in bench}
    for prop, metric in RISK_PROPERTIES.items():
        bounds = risk_thresholds([r["pooled"]["histograms"][prop] for r in bench], RISK_QUANTILES[prop])
        profiles = [profile(r["pooled"]["histograms"][prop], bounds) for r in bench]
        limits = calibrate(profiles)
        stars = [rate(p, limits) for p in profiles]
        for r, p, s in zip(bench, profiles, stars):
            measured[r["name"]][prop] = {"shares": [round(x, 4) for x in p], "stars": s}
        properties[prop] = {
            "kind": "risk-profile",
            "metric": metric,
            "bounds": bounds,
            "stars": {str(level): caps for level, caps in limits.items()},
            "benchmark_spread": spread(stars),
        }
    dup = [r for r in bench if r["pooled"]["duplication"] is not None]
    if len(dup) >= 10:
        limits = {lvl: caps[0] for lvl, caps in calibrate([(r["pooled"]["duplication"],) for r in dup]).items()}
        stars = [rate((r["pooled"]["duplication"],), {lvl: [cap] for lvl, cap in limits.items()}) for r in dup]
        for r, s in zip(dup, stars):
            measured[r["name"]]["duplication"] = {"share": round(r["pooled"]["duplication"], 4), "stars": s}
        properties["duplication"] = {
            "kind": "share",
            "metric": "duplicated lines as a share of all lines, jscpd 5 (6 lines, 30 tokens, weak mode), one run per language",
            "stars": {str(level): cap for level, cap in limits.items()},
            "benchmark_spread": spread(stars),
            "repositories": len(dup),
        }

    coupled = [r for r in bench if r["coupling"][0] is not None]
    not_coupled = {r["name"]: r["coupling"][1] for r in bench if r["coupling"][0] is None}
    not_calibrated = {}
    coupling_tools = sorted({t for r in coupled for t in r["coupling"][0]["tools"]})
    if len(coupled) >= 10:
        hists = [r["coupling"][0]["histogram"] for r in coupled]
        bounds = risk_thresholds(hists, RISK_QUANTILES["module_coupling"])
        profiles = [profile(h, bounds) for h in hists]
        limits = calibrate(profiles)
        stars = [rate(p, limits) for p in profiles]
        for r, p, st in zip(coupled, profiles, stars):
            measured[r["name"]]["module_coupling"] = {"shares": [round(x, 4) for x in p], "stars": st}
        properties["module_coupling"] = {
            "kind": "risk-profile",
            "metric": "fan-in per module: distinct depending modules (pdepend, grimp, dependency-cruiser)",
            "bounds": bounds,
            "stars": {str(level): caps for level, caps in limits.items()},
            "benchmark_spread": spread(stars),
            "repositories": len(coupled),
        }
        # Higher independence is better: calibrated on the negated share, published as a minimum.
        values = [r["coupling"][0]["independence"] for r in coupled]
        limits = {lvl: -caps[0] for lvl, caps in calibrate([(-v,) for v in values]).items()}
        stars = [rate((-v,), {lvl: [-cap] for lvl, cap in limits.items()}) for v in values]
        for r, v, st in zip(coupled, values, stars):
            measured[r["name"]]["component_independence"] = {"share": round(v, 4), "stars": st}
        properties["component_independence"] = {
            "kind": "share-min",
            "metric": "share of code in modules no other component depends on, code-line weighted over languages; "
                      "higher is better",
            "stars": {str(level): cap for level, cap in limits.items()},
            "benchmark_spread": spread(stars),
            "repositories": len(coupled),
        }
        values = [r["coupling"][0]["entanglement"] for r in coupled]
        limits = {lvl: caps[0] for lvl, caps in calibrate([(v,) for v in values]).items()}
        stars = [rate((v,), {lvl: [cap] for lvl, cap in limits.items()}) for v in values]
        for r, v, st in zip(coupled, values, stars):
            measured[r["name"]]["component_entanglement"] = {"share": round(v, 4), "stars": st}
        properties["component_entanglement"] = {
            "kind": "share",
            "metric": "violation degree of the component graph, code-line weighted over languages; lower is better",
            "stars": {str(level): cap for level, cap in limits.items()},
            "benchmark_spread": spread(stars),
            "repositories": len(coupled),
        }
    else:
        for prop in ("module_coupling", "component_independence", "component_entanglement"):
            not_calibrated[prop] = "no benchmark measures yet, because the coupling tools are not in the checker image"

    thresholds = {
        "version": args.date,
        "track": "open",
        "description": "Open-track maintainability thresholds, derived from a public benchmark of Common Ground and "
                       "Developer Overheid repositories with the benchmark method of Alves et al. Not a SIG rating.",
        "method": {
            "risk_thresholds": "Alves, Ypma and Visser 2010, section IV and Table IV: metric values at 70/80/90% "
                               "(unit interfacing 80/90/95%) of the LOC-weighted unit distribution, every repository "
                               "weighing the same",
            "star_limits": "Alves, Correia and Visser 2011, Algorithm 1 (section III-A), partition 5/30/30/30/5%; "
                           "stars per section III-B1: the lowest of the per-share levels",
            "pooling": "all languages of a repository are pooled",
            "rounding": "star limits are rounded up to 4 decimals",
            "regenerate": "scripts/open-benchmark/README.md",
        },
        "distribution": {"5": 0.05, "4": 0.30, "3": 0.30, "2": 0.30, "1": 0.05},
        "tools": {**json.loads(tools[0]), **({"coupling": coupling_tools} if coupling_tools else {})},
        "benchmark": {"repositories": len(bench), "list": "scripts/open-benchmark/benchmark.json",
                      "min_code_loc": MIN_CODE_LOC, "max_per_owner": MAX_PER_OWNER},
        "properties": properties,
        "not_calibrated": not_calibrated,
    }
    os.makedirs(args.thresholds_dir, exist_ok=True)
    with open(os.path.join(args.thresholds_dir, f"thresholds-{args.date}.json"), "w") as fh:
        json.dump(thresholds, fh, indent=2)
        fh.write("\n")

    rows = []
    for r in bench:
        c = by_name.get(r["name"], {})
        rows.append({
            "name": r["name"], "url": r["url"], "commit": r["commit"],
            "languages": r["pooled"]["languages"], "code_loc": r["pooled"]["code_loc"],
            "unit_loc": r["pooled"]["unit_loc"], "licence": c.get("licence"),
            "reason": reason(r, c), "measured": measured[r["name"]],
        })
    benchmark = {"version": args.date, "repositories": rows,
                 "left_out": {"below_min_code_loc": small, "over_owner_cap": capped,
                              **({"coupling_not_measured": not_coupled} if coupled else {})}}
    with open(os.path.join(args.out_dir, "benchmark.json"), "w") as fh:
        json.dump(benchmark, fh, indent=1)
        fh.write("\n")
    with open(os.path.join(args.out_dir, "benchmark.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "url", "commit", "languages", "code_loc", "licence", "reason"])
        for row in rows:
            langs = " ".join(f"{k}:{v}" for k, v in sorted(row["languages"].items()))
            w.writerow([row["name"], row["url"], row["commit"], langs, row["code_loc"], row["licence"], row["reason"]])
    print(json.dumps({"repositories": len(bench), "properties": {
        k: {"bounds": v.get("bounds"), "stars": v["stars"], "spread": v["benchmark_spread"]} for k, v in properties.items()}},
        indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
