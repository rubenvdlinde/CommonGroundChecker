import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const DERIVE = path.join(process.cwd(), "scripts", "open-benchmark", "derive.py");
const MEASURE = path.join(process.cwd(), "scripts", "open-track", "measure.py");
const hasPython = spawnSync("python3", ["--version"]).status === 0;
const hasLizard = hasPython && spawnSync("python3", ["-c", "import lizard"]).status === 0;

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "open-benchmark-test-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface Repo {
  unitSize: Record<string, number>;
  duplication: number;
}

/** A work dir with one measures file per repository, each of its own owner. */
function workDir(repos: Repo[]): string {
  const work = tempDir();
  mkdirSync(path.join(work, "measures"));
  const candidates = repos.map((_, index) => ({ name: `owner${index}/repo`, url: `https://example.org/${index}`, stars: 0 }));
  repos.forEach((repo, index) => {
    const unitLoc = Object.values(repo.unitSize).reduce((sum, loc) => sum + loc, 0);
    const measures = {
      schema: 1,
      name: `owner${index}/repo`,
      url: `https://example.org/${index}`,
      head: "0".repeat(40),
      files: 1,
      tools: { lizard: "1.24.3", jscpd: "5.4.2" },
      languages: {
        php: {
          code_loc: 2000,
          unit_loc: unitLoc,
          unit_size: repo.unitSize,
          unit_complexity: { "1": unitLoc },
          unit_interfacing: { "0": unitLoc },
          duplication: { lines: 1000, duplicated_lines: Math.round(repo.duplication * 1000) },
        },
      },
    };
    writeFileSync(path.join(work, "measures", `${index}.json`), JSON.stringify(measures));
  });
  writeFileSync(path.join(work, "candidates.json"), JSON.stringify({ candidates }));
  return work;
}

function derive(work: string) {
  const run = spawnSync(
    "python3",
    [DERIVE, work, "--date", "2000-01-01", "--candidates", path.join(work, "candidates.json"), "--out-dir", work, "--thresholds-dir", work],
    { encoding: "utf8" }
  );
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  return {
    thresholds: JSON.parse(readFileSync(path.join(work, "thresholds-2000-01-01.json"), "utf8")),
    benchmark: JSON.parse(readFileSync(path.join(work, "benchmark.json"), "utf8")),
  };
}

describe.skipIf(!hasPython)("scripts/open-benchmark/derive.py", () => {
  const twenty = Array.from({ length: 20 }, (_, index) => index);

  it("puts the risk thresholds at 70, 80 and 90% of the LOC-weighted unit distribution", () => {
    const work = workDir(twenty.map(() => ({ unitSize: { "1": 70, "2": 10, "3": 10, "4": 10 }, duplication: 0.05 })));

    const { thresholds } = derive(work);

    expect(thresholds.properties.unit_size.bounds).toEqual([1, 2, 3]);
    expect(thresholds.properties.unit_size.stars["4"]).toEqual([0.3, 0.2, 0.1]);
  });

  it("weighs every repository the same, whatever its size", () => {
    const repos = twenty.map((index): Repo =>
      index < 10 ? { unitSize: { "10": 1000 }, duplication: 0 } : { unitSize: { "50": 10 }, duplication: 0 }
    );

    const { thresholds } = derive(workDir(repos));

    expect(thresholds.properties.unit_size.bounds).toEqual([50, 51, 52]);
  });

  it("keeps the bounds apart when one value holds most of the code", () => {
    const { thresholds } = derive(workDir(twenty.map(() => ({ unitSize: { "0": 100 }, duplication: 0 }))));

    expect(thresholds.properties.unit_interfacing.bounds).toEqual([0, 1, 2]);
  });

  it("spreads the benchmark over the star levels as 5/30/30/30/5", () => {
    const repos = twenty.map((index) => ({ unitSize: { "1": 100 }, duplication: (index + 1) / 100 }));

    const { thresholds, benchmark } = derive(workDir(repos));

    expect(thresholds.properties.duplication.stars).toEqual({ "5": 0.01, "4": 0.07, "3": 0.13, "2": 0.19 });
    expect(thresholds.properties.duplication.benchmark_spread).toEqual({ "5": 0.05, "4": 0.3, "3": 0.3, "2": 0.3, "1": 0.05 });
    expect(benchmark.repositories).toHaveLength(20);
    expect(benchmark.repositories[0].measured.duplication).toEqual({ share: 0.01, stars: 5 });
  });

  it("calibrates star limits with Algorithm 1 of Alves et al. 2011: exact partition, no limit can be lowered", () => {
    const script = [
      "import json, random, sys",
      `sys.path.insert(0, ${JSON.stringify(path.dirname(DERIVE))})`,
      "import derive",
      "random.seed(3)",
      "profiles = [(round(random.random(), 3), round(random.random() * 0.5, 3), round(random.random() * 0.2, 3)) for _ in range(20)]",
      "limits = derive.calibrate(profiles)",
      "counts = [sum(1 for p in profiles if derive.rate(p, limits) == level) for level in (5, 4, 3, 2, 1)]",
      "needed = {5: 1, 4: 7, 3: 13, 2: 19}",
      "lowerable = []",
      "for level, caps in limits.items():",
      "    for k in range(3):",
      "        below = [p[k] for p in profiles if p[k] < caps[k]]",
      "        if below:",
      "            trial = {**limits, level: [*caps]}",
      "            trial[level][k] = max(below)",
      "            if sum(1 for p in profiles if derive.rate(p, trial) >= level) >= needed[level]:",
      "                lowerable.append([level, k])",
      "print(json.dumps({'counts': counts, 'lowerable': lowerable}))",
    ].join("\n");

    const run = spawnSync("python3", ["-B", "-c", script], { encoding: "utf8" });

    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout)).toEqual({ counts: [1, 6, 6, 6, 1], lowerable: [] });
  });

  it("calibrates coupling from the coupling measures, higher independence rating better", () => {
    const work = workDir(twenty.map(() => ({ unitSize: { "1": 100 }, duplication: 0 })));
    mkdirSync(path.join(work, "coupling"));
    twenty.forEach((index) => {
      const coupling =
        index === 0
          ? { error: "clone failed" }
          : {
              version: 1,
              languages: {
                php: {
                  measured: true,
                  tool: "pdepend 3.0.0",
                  loc: 100,
                  componentIndependence: index / 20,
                  componentEntanglement: { violationDegree: index / 100 },
                  moduleCoupling: { fanInHistogram: { "0": 70, "5": 10, "10": 10, "30": 10 } },
                },
              },
            };
      writeFileSync(path.join(work, "coupling", `${index}.json`), JSON.stringify(coupling));
    });

    const { thresholds, benchmark } = derive(work);

    expect(thresholds.properties.module_coupling.bounds).toEqual([0, 5, 10]);
    expect(thresholds.properties.component_independence.kind).toBe("share-min");
    expect(thresholds.properties.component_independence.stars["5"]).toBe(0.95);
    expect(thresholds.properties.component_entanglement.stars["5"]).toBe(0.01);
    expect(thresholds.properties.component_independence.repositories).toBe(19);
    expect(thresholds.not_calibrated).toEqual({});
    expect(thresholds.tools.coupling).toEqual(["pdepend 3.0.0"]);
    expect(benchmark.left_out.coupling_not_measured).toEqual({ "owner0/repo": "clone failed" });
    const best = benchmark.repositories.find((repository: { name: string }) => repository.name === "owner19/repo");
    expect(best.measured.component_independence).toEqual({ share: 0.95, stars: 5 });
  });

  it("leaves out repositories below the size limit", () => {
    const work = workDir(twenty.map(() => ({ unitSize: { "1": 100 }, duplication: 0 })));
    const file = path.join(work, "measures", "0.json");
    const small = JSON.parse(readFileSync(file, "utf8"));
    small.languages.php.code_loc = 1999;
    writeFileSync(file, JSON.stringify(small));

    const { benchmark } = derive(work);

    expect(benchmark.repositories).toHaveLength(19);
    expect(benchmark.left_out.below_min_code_loc).toEqual(["owner0/repo"]);
  });
});

describe.skipIf(!hasLizard)("scripts/open-track/measure.py", () => {
  it("writes a histogram of unit LOC per metric value for every language", () => {
    const repo = tempDir();
    writeFileSync(
      path.join(repo, "app.py"),
      "def one(a, b):\n    if a:\n        return b\n    return a\n\n\ndef two():\n    return 2\n"
    );

    const run = spawnSync("python3", [MEASURE, repo], { encoding: "utf8" });

    expect(run.status).toBe(0);
    const measures = JSON.parse(run.stdout);
    expect(measures.languages.python).toMatchObject({
      units: 2,
      unit_loc: 6,
      unit_size: { "2": 2, "4": 4 },
      unit_complexity: { "1": 2, "2": 4 },
      unit_interfacing: { "0": 2, "2": 4 },
    });
    expect(measures.languages.python.duplication).toBeUndefined();
  });
});
