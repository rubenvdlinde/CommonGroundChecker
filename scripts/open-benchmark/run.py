#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Conduction <info@conduction.nl>
# SPDX-License-Identifier: EUPL-1.2
"""Measure every benchmark candidate with the open-track measure script.

  run.py <work dir> [--candidates candidates.json] [--pinned benchmark.json] [--jobs N] [--jscpd PATH]
  run.py <work dir> --coupling-image IMAGE --pinned benchmark.json [--jobs N]

Each repository is cloned shallow and blobless into <work dir>/clones, measured
with scripts/open-track/measure.py (lizard units and jscpd 5 duplication), and
the clone is deleted again. Measures land in <work dir>/measures/<slug>.json;
a repository that already has measures is skipped, so a broken run resumes.

Without --pinned the default branch is measured as it is now. With --pinned
(a benchmark.json written by derive.py) every repository is checked out at the
commit recorded there, which reproduces the published thresholds.

With --coupling-image the coupling measures are taken instead, with coupling.py
inside a container of IMAGE that holds the coupling tools (Dockerfile.coupling).
They land in <work dir>/coupling/<slug>.json; a run that fails as a whole is
recorded there as {"error": ...}.
"""

import argparse
import concurrent.futures
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MEASURE = os.path.join(HERE, "..", "open-track", "measure.py")


def slug(name):
    return name.replace("/", "__")


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)


def clone(url, target, sha=None):
    """A shallow, blobless clone of the default branch, or of one commit."""
    if sha:
        os.makedirs(target)
        steps = [("init", "-q"), ("remote", "add", "origin", url),
                 ("fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", sha),
                 ("checkout", "-q", "FETCH_HEAD")]
        for step in steps:
            p = git(*step, cwd=target)
            if p.returncode:
                return p.stderr.strip()[-300:]
        return None
    p = git("clone", "-q", "--depth", "1", "--filter=blob:none", url, target)
    return p.stderr.strip()[-300:] if p.returncode else None


def coupling_one(work, candidate, sha, image, prefix, time_limit):
    out_dir = os.path.join(work, "coupling")
    out = os.path.join(out_dir, slug(candidate["name"]) + ".json")
    if os.path.isfile(out):
        return candidate["name"], "cached"
    target = os.path.join(work, "clones", slug(candidate["name"]) + "-coupling")
    shutil.rmtree(target, ignore_errors=True)
    started = time.time()
    try:
        error = clone(candidate["url"], target, sha)
        if not error:
            name = f"{prefix}-{slug(candidate['name']).lower().replace('_', '-').replace('.', '-')}"[:120]
            p = subprocess.run(
                ["docker", "run", "--rm", "--name", name, "--user", f"{os.getuid()}:{os.getgid()}",
                 "-v", f"{os.path.abspath(target)}:/repo:ro", "-v", f"{os.path.abspath(os.path.join(HERE, '..'))}:/scripts:ro",
                 "-v", f"{os.path.abspath(out_dir)}:/out", image, "python3", "/scripts/open-benchmark/coupling.py", "/repo",
                 "--json", f"/out/{slug(candidate['name'])}.json.part", "--time-limit", str(time_limit)],
                capture_output=True, text=True)
            if p.returncode not in (0, 4):
                error = f"coupling.py exited {p.returncode}: {(p.stderr or p.stdout).strip()[-300:]}"
        measures = {"error": error} if error else json.load(open(out + ".part"))
        measures.update(name=candidate["name"], url=candidate["url"], commit=sha, seconds=round(time.time() - started, 1))
        with open(out, "w") as fh:
            json.dump(measures, fh, indent=1, sort_keys=True)
            fh.write("\n")
        if os.path.exists(out + ".part"):
            os.remove(out + ".part")
        return candidate["name"], error or f"measured in {measures['seconds']} s"
    finally:
        shutil.rmtree(target, ignore_errors=True)


def run_one(work, candidate, sha, jscpd):
    out = os.path.join(work, "measures", slug(candidate["name"]) + ".json")
    if os.path.isfile(out):
        return candidate["name"], "cached"
    target = os.path.join(work, "clones", slug(candidate["name"]))
    shutil.rmtree(target, ignore_errors=True)
    started = time.time()
    try:
        error = clone(candidate["url"], target, sha)
        if error:
            return candidate["name"], f"clone failed: {error}"
        args = [sys.executable, MEASURE, target, "--json", out + ".part"]
        if jscpd:
            args += ["--jscpd", jscpd]
        p = subprocess.run(args, capture_output=True, text=True)
        if p.returncode not in (0, 4):
            return candidate["name"], f"measure failed ({p.returncode}): {p.stderr.strip()[-300:]}"
        with open(out + ".part") as fh:
            measures = json.load(fh)
        measures["name"] = candidate["name"]
        measures["url"] = candidate["url"]
        measures["seconds"] = round(time.time() - started, 1)
        with open(out, "w") as fh:
            json.dump(measures, fh, indent=1, sort_keys=True)
            fh.write("\n")
        os.remove(out + ".part")
        return candidate["name"], f"measured in {measures['seconds']} s"
    finally:
        shutil.rmtree(target, ignore_errors=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("work")
    parser.add_argument("--candidates", default=os.path.join(HERE, "candidates.json"))
    parser.add_argument("--pinned", help="benchmark.json: measure each repository at its recorded commit")
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--jscpd", default=shutil.which("jscpd"), help="jscpd 5 executable")
    parser.add_argument("--coupling-image", help="measure coupling in containers of this image")
    parser.add_argument("--container-prefix", default="open-benchmark", help="name prefix of the containers")
    parser.add_argument("--time-limit", type=int, default=1800, help="seconds the coupling tools may take per repository")
    args = parser.parse_args(argv)
    if args.coupling_image and not args.pinned:
        parser.error("--coupling-image measures the benchmark repositories: pass --pinned benchmark.json")
    if not args.jscpd and not args.coupling_image:
        parser.error("jscpd 5 is needed: put it on PATH or pass --jscpd")
    os.makedirs(os.path.join(args.work, "measures"), exist_ok=True)
    os.makedirs(os.path.join(args.work, "clones"), exist_ok=True)
    os.makedirs(os.path.join(args.work, "coupling"), exist_ok=True)
    if args.pinned:
        with open(args.pinned) as fh:
            pinned = json.load(fh)["repositories"]
        jobs = [({"name": r["name"], "url": r["url"]}, r["commit"]) for r in pinned]
    else:
        with open(args.candidates) as fh:
            jobs = [(c, None) for c in json.load(fh)["candidates"]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        if args.coupling_image:
            futures = [pool.submit(coupling_one, args.work, c, sha, args.coupling_image, args.container_prefix,
                                   args.time_limit) for c, sha in jobs]
        else:
            futures = [pool.submit(run_one, args.work, c, sha, args.jscpd) for c, sha in jobs]
        for future in concurrent.futures.as_completed(futures):
            name, status = future.result()
            print(f"{name}: {status}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
