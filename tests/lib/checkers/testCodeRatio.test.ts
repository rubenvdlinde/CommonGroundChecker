import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTestCodeRatioResult,
  checkTestCodeRatio,
  classifyFile,
  computeTestCodeRatio,
  countCodeLines,
  ratioToStars,
  starsToStatus,
} from "@/lib/checkers/testCodeRatio";

describe("classifyFile", () => {
  it.each([
    "tests/Unit/FooTest.php",
    "src/test/java/nl/example/FooTest.java",
    "test/helpers.js",
    "src/__tests__/widget.tsx",
    "spec/models/user_spec.rb",
    "src/components/Button.test.tsx",
    "src/utils/date.spec.ts",
    "pkg/server/handler_test.go",
    "app/test_models.py",
    "lib/Service/FooTest.php",
    "Tests/Unit/Foo.cs",
  ])("classifies %s as test", (file) => {
    expect(classifyFile(file)).toBe("test");
  });

  it.each([
    "src/main.ts",
    "lib/Service/FooService.php",
    "app/models.py",
    "src/components/Button.vue",
    "cmd/server/main.go",
    "src/attestation.ts",
    "src/contest/Results.java",
    "src/latest.js",
  ])("classifies %s as production", (file) => {
    expect(classifyFile(file)).toBe("production");
  });

  it.each([
    "node_modules/lodash/index.js",
    "vendor/symfony/console/Application.php",
    "dist/app.js",
    "build/main.js",
    "coverage/lcov-report/prettify.js",
    "src/generated/client.ts",
    ".next/server/page.js",
    "js/jquery.min.js",
    "vendor/phpunit/tests/FooTest.php",
    "README.md",
    "package.json",
    "docs/tests/guide.md",
  ])("excludes %s", (file) => {
    expect(classifyFile(file)).toBe("excluded");
  });
});

describe("countCodeLines", () => {
  it("skips blank lines and pure comment lines", () => {
    const content = [
      "<?php",
      "",
      "/**",
      " * Docblock",
      " */",
      "// line comment",
      "# hash comment",
      "#[Attribute]",
      "class Foo",
      "{",
      "    return 1; // trailing comment counts as code",
      "}",
      "   ",
    ].join("\n");
    expect(countCodeLines(content)).toBe(6);
  });

  it("handles CRLF line endings and empty content", () => {
    expect(countCodeLines("a();\r\n\r\nb();\r\n")).toBe(2);
    expect(countCodeLines("")).toBe(0);
  });
});

describe("ratioToStars", () => {
  it.each([
    [150, 5],
    [120, 5],
    [119.9, 4],
    [100, 4],
    [99.9, 3],
    [75, 3],
    [74.9, 2],
    [25, 2],
    [24.9, 1],
    [0, 1],
  ])("rates a %s percent ratio as %s stars", (ratio, stars) => {
    expect(ratioToStars(ratio)).toBe(stars);
  });

  it("maps stars to a status", () => {
    expect(starsToStatus(5)).toBe("pass");
    expect(starsToStatus(4)).toBe("pass");
    expect(starsToStatus(3)).toBe("warn");
    expect(starsToStatus(2)).toBe("fail");
    expect(starsToStatus(1)).toBe("fail");
  });
});

describe("computeTestCodeRatio and buildTestCodeRatioResult", () => {
  it("returns null without production code", () => {
    expect(computeTestCodeRatio(10, 0)).toBeNull();
    expect(computeTestCodeRatio(50, 200)).toBe(25);
  });

  it("warns without stars when there is no production code", () => {
    const result = buildTestCodeRatioResult({
      testLines: 40,
      productionLines: 0,
      testFiles: 2,
      productionFiles: 0,
    });
    expect(result.id).toBe("testcoderatio");
    expect(result.status).toBe("warn");
    expect(result.message).not.toMatch(/stars/);
  });

  it("reports the ratio, stars, counts and bands", () => {
    const result = buildTestCodeRatioResult({
      testLines: 632,
      productionLines: 1000,
      testFiles: 4,
      productionFiles: 10,
    });
    expect(result.status).toBe("fail");
    expect(result.message).toBe("Test code ratio 63.2% (2 of 5 stars).");
    expect(result.evidence).toContain("Test code: 632 lines in 4 files");
    expect(result.evidence).toContain("Production code: 1,000 lines in 10 files");
    expect(result.evidence?.some((line) => line.startsWith("Bands: >=120% = 5 stars"))).toBe(true);
  });

  it("passes at 4 stars and warns at 3 stars", () => {
    const counts = { testFiles: 1, productionFiles: 1 };
    expect(
      buildTestCodeRatioResult({ ...counts, testLines: 100, productionLines: 100 }).status
    ).toBe("pass");
    expect(
      buildTestCodeRatioResult({ ...counts, testLines: 80, productionLines: 100 }).status
    ).toBe("warn");
  });
});

describe("checkTestCodeRatio", () => {
  it("warns when no local clone is available", async () => {
    const result = await checkTestCodeRatio(undefined);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("could not be cloned");
  });

  it("measures only git-tracked files of a local repository", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cgchecker-ratio-"));
    try {
      await mkdir(path.join(dir, "src"), { recursive: true });
      await mkdir(path.join(dir, "tests"), { recursive: true });
      await mkdir(path.join(dir, "node_modules", "dep"), { recursive: true });
      await writeFile(path.join(dir, "src", "app.ts"), "// header\nconst a = 1;\nconst b = 2;\n\nexport { a, b };\n");
      await writeFile(path.join(dir, "tests", "app.test.ts"), "import { a } from '../src/app';\nexpect(a).toBe(1);\n");
      await writeFile(path.join(dir, "node_modules", "dep", "index.js"), "module.exports = 1;\n");
      await writeFile(path.join(dir, "src", "untracked.ts"), "const ignored = true;\n");

      execFileSync("git", ["init", "-q", dir]);
      execFileSync("git", ["-C", dir, "add", "src/app.ts", "tests/app.test.ts", "node_modules/dep/index.js"]);

      const result = await checkTestCodeRatio(dir);
      expect(result.message).toBe("Test code ratio 66.7% (2 of 5 stars).");
      expect(result.evidence).toContain("Test code: 2 lines in 1 file");
      expect(result.evidence).toContain("Production code: 3 lines in 1 file");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("carries the stars as starRating", () => {
    const result = buildTestCodeRatioResult({ testLines: 80, testFiles: 4, productionLines: 100, productionFiles: 5 });

    expect(result.starRating).toBe(3);
  });
});
