import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPTS = path.join(process.cwd(), "scripts", "maintainability");
const FAKE_JAVA = path.join(process.cwd(), "tests", "fixtures", "bin", "fake-java");

const BLOCK = ["$a = 1;", "$b = 2;", "$c = 3;", "$d = 4;", "$e = 5;", "$f = 6;", "$g = 7;", "$h = 8;"];

/** Runs one function of estimate_report.py and returns its JSON result. */
function call(expression: string, env: Record<string, string> = {}): unknown {
  const code = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(SCRIPTS)})`,
    "import estimate_report as e",
    `print(json.dumps(${expression}))`,
  ].join("\n");
  return JSON.parse(execFileSync("python3", ["-c", code], { env: { ...process.env, ...env } }).toString());
}

describe("estimate_report.py Simian cross-check", () => {
  let dir: string;
  let repo: string;
  let jar: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "estimate-report-test-"));
    repo = path.join(dir, "repo");
    jar = path.join(dir, "simian.jar");
    execFileSync("git", ["init", "-q", repo]);
    await writeFile(jar, "");
    await writeFile(path.join(repo, "a.php"), BLOCK.join("\n") + "\n");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function crossCheck(lang = "php", env: Record<string, string> = {}): Record<string, unknown> {
    const args = [repo, [FAKE_JAVA, jar], ["a.php", "b.php"], lang, 16].map((value) => JSON.stringify(value));
    return call(`e.cross_check(${args.join(", ")})`, env) as Record<string, unknown>;
  }

  it("counts the copy's code lines that equal the first copy without whitespace", async () => {
    const copy = ["  $a  =  1;", ...BLOCK.slice(1, 7), "$other = 0;"];
    await writeFile(path.join(repo, "b.php"), copy.join("\n") + "\n");

    expect(crossCheck()).toEqual({ code_lines: 16, redundant_lines: 7, share: 0.4375, stars: 1, clone_sets: 1 });
  });

  it("drops a copy with fewer than 6 literally equal code lines", async () => {
    const copy = [...BLOCK.slice(0, 5), "$x = 0;", "$y = 0;", "$z = 0;"];
    await writeFile(path.join(repo, "b.php"), copy.join("\n") + "\n");

    expect(crossCheck()).toMatchObject({ redundant_lines: 0, share: 0 });
  });

  it("does not count comment lines", async () => {
    const copy = [...BLOCK.slice(0, 5), "// $f = 6;", "$g = 7;", "$h = 8;"];
    await writeFile(path.join(repo, "a.php"), copy.join("\n") + "\n");
    await writeFile(path.join(repo, "b.php"), copy.join("\n") + "\n");

    expect(crossCheck()).toMatchObject({ redundant_lines: 7 });
  });

  it("gives Vue no cross-check", () => {
    expect(crossCheck("vue")).toEqual({ notMeasured: "Simian has no support for this language" });
  });

  it("reports a Simian that runs out of heap as not measured", async () => {
    await writeFile(path.join(repo, "b.php"), BLOCK.join("\n") + "\n");

    expect(crossCheck("php", { FAKE_SIMIAN_OOM: "1", SIMIAN_HEAP: "64m" })).toEqual({
      notMeasured: "Simian ran out of its 64m heap",
    });
  });

  it("refuses a Simian that is not the pinned version", async () => {
    await writeFile(path.join(repo, "b.php"), BLOCK.join("\n") + "\n");

    expect(crossCheck("php", { FAKE_SIMIAN_VERSION: "4.3.0" })).toEqual({
      notMeasured: "Simian reports version 4.3.0, not the pinned 4.2.1",
    });
  });

  it("names the missing jar", () => {
    const missing = path.join(dir, "missing.jar");

    expect(call("e.find_simian()", { SIMIAN_JAR: missing })).toEqual([
      null,
      `Simian 4.2.1 is not installed at ${missing}`,
    ]);
  });
});
