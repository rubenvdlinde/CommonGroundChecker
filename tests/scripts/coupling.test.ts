import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_DIR = path.join(process.cwd(), "scripts", "coupling");
const SCRIPT = path.join(SCRIPT_DIR, "check_coupling.py");

/** Runs `expression` against the coupling script module and returns its value as JSON. */
function python(expression: string): unknown {
  const code = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})`,
    "import check_coupling as c",
    `print(json.dumps(${expression}))`,
  ].join("\n");
  return JSON.parse(
    execFileSync("python3", ["-c", code], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } })
  );
}

const temporary: string[] = [];

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("coupling scorer", () => {
  // a.php and b.php depend on each other across components x and y; c.php in x is used by nothing outside x.
  const graph = `c.score({"src/x/a.php": 10, "src/x/c.php": 30, "src/y/b.php": 60}, {("src/x/a.php", "src/y/b.php"), ("src/y/b.php", "src/x/a.php"), ("src/x/a.php", "src/x/c.php"), ("src/x/a.php", "src/x/a.php")})`;

  it("counts modules, edges and components without self edges", () => {
    const result = python(graph) as Record<string, unknown>;

    expect(result.modules).toBe(3);
    expect(result.edges).toBe(3);
    expect(result.loc).toBe(100);
    expect(result.components).toBe(2);
    expect(result.componentDefinition).toContain("directories below src/");
  });

  it("measures independence, entanglement and cycles", () => {
    const result = python(graph) as {
      componentIndependence: number;
      componentEntanglement: { violationDegree: number; communicationLines: number; violations: Record<string, number> };
      cycles: Record<string, number>;
    };

    expect(result.componentIndependence).toBe(0.3);
    expect(result.componentEntanglement.communicationLines).toBe(2);
    expect(result.componentEntanglement.violations).toEqual({ cyclic: 2 });
    expect(result.componentEntanglement.violationDegree).toBe(1);
    expect(result.cycles).toEqual({
      moduleCycles: 1,
      modulesInCycles: 2,
      locShareInCycles: 0.7,
      largestModuleCycle: 2,
      componentCycles: 1,
      largestComponentCycle: 2,
    });
  });

  it("puts every module in one fan-in band", () => {
    const fans = Array.from({ length: 12 }, (_, i) => `("m${i}.js", "hub.js")`).join(", ");
    const loc = Array.from({ length: 12 }, (_, i) => `"m${i}.js": 5`).join(", ");
    const result = python(`c.score({${loc}, "hub.js": 40}, {${fans}})`) as {
      moduleCoupling: {
        riskProfile: Record<string, number>;
        above: number[];
        fanInHistogram: Record<string, number>;
        highestFanIn: { module: string; fanIn: number }[];
      };
    };

    expect(result.moduleCoupling.riskProfile).toEqual({ low: 0.6, moderate: 0.4, high: 0, veryHigh: 0 });
    expect(result.moduleCoupling.above).toEqual([0.4, 0, 0]);
    expect(result.moduleCoupling.fanInHistogram).toEqual({ "0": 60, "12": 40 });
    expect(result.moduleCoupling.highestFanIn[0]).toEqual({ module: "hub.js", fanIn: 12 });
  });

  it("splits a PHP directory over the batch size into its subdirectories and own files", () => {
    const files = JSON.stringify(["lib/A.php", "lib/Db/B.php", "lib/Db/C.php", "lib/Service/D.php", "lib/Service/E.php"]);

    expect(python(`c.php_batches(${files}, 5)`)).toEqual([["lib"]]);
    expect(python(`c.php_batches(${files}, 2)`)).toEqual([["lib/A.php"], ["lib/Db"], ["lib/Service"]]);
  });

  it("tells local imports from packages", () => {
    expect(python(`[c.is_local(s, {"@": "/r/src"}) for s in ["./a", "@/store", "@nextcloud/vue", "vue"]]`)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("check_coupling.py", () => {
  function repository(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(os.tmpdir(), "coupling-test-"));
    temporary.push(root);
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      writeFileSync(path.join(root, name), content);
    }
    return root;
  }

  function runScript(repo: string): { code: number; report: Record<string, unknown> | null } {
    const out = path.join(repo, "..", `${path.basename(repo)}.json`);
    temporary.push(out);
    const env = {
      ...process.env,
      COUPLING_TOOLS_DIR: path.join(repo, "no-tools"),
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      PYTHONDONTWRITEBYTECODE: "1",
    };
    try {
      execFileSync("python3", [SCRIPT, repo, "--json", out], { env, stdio: "ignore" });
    } catch (error) {
      return { code: (error as { status: number }).status, report: null };
    }
    return { code: 0, report: JSON.parse(readFileSync(out, "utf8")) };
  }

  it("reports a language whose tool is missing as not measured, with the reason", () => {
    const repo = repository({
      "composer.json": JSON.stringify({ autoload: { "psr-4": { "App\\": "lib/" } } }),
      "lib/Service.php": "<?php\nnamespace App;\nclass Service {}\n",
    });
    const { code, report } = runScript(repo);

    expect(code).toBe(0);
    expect(report?.languages).toEqual({
      php: { measured: false, reason: "pdepend 3.0.0 is not installed", files: 1 },
    });
  });

  it("exits 4 when there is no source code to measure", () => {
    const { code } = runScript(repository({ "README.md": "# empty\n" }));

    expect(code).toBe(4);
  });
});
