import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkSpdxHeaders,
  evaluateSpdxCoverage,
  formatShare,
  hasSpdxHeader,
  matchesDep5Pattern,
  matchesReuseGlob,
  parseDep5Patterns,
  parseReuseTomlPaths,
  selectSourceFiles,
  shareToStars,
  starsToStatus,
} from "@/lib/checkers/spdxHeaders";

describe("hasSpdxHeader", () => {
  it("finds the tag within the first 30 lines", () => {
    expect(hasSpdxHeader("<?php\n/**\n * SPDX-License-Identifier: EUPL-1.2\n */")).toBe(true);
    expect(hasSpdxHeader(`${"\n".repeat(29)}// SPDX-License-Identifier: MIT`)).toBe(true);
  });

  it("ignores a tag after line 30 and a file without one", () => {
    expect(hasSpdxHeader(`${"\n".repeat(30)}// SPDX-License-Identifier: MIT`)).toBe(false);
    expect(hasSpdxHeader("export const x = 1;\n")).toBe(false);
  });
});

describe("selectSourceFiles", () => {
  it("keeps source extensions and drops excluded paths and minified files", () => {
    expect(
      selectSourceFiles([
        "lib/Service.php",
        "src/main.ts",
        "src/App.vue",
        "src/style.scss",
        "README.md",
        "node_modules/x/index.js",
        "vendor/a/b.php",
        "dist/app.js",
        "src/generated/client.ts",
        "js/lib.min.js",
        ".next/server.js",
      ])
    ).toEqual(["lib/Service.php", "src/main.ts", "src/App.vue", "src/style.scss"]);
  });
});

describe("REUSE.toml globs", () => {
  it("matches * within one segment only", () => {
    expect(matchesReuseGlob("src/a.ts", "src/*")).toBe(true);
    expect(matchesReuseGlob("src/sub/a.ts", "src/*")).toBe(false);
    expect(matchesReuseGlob("src/a.ts", "src/*.ts")).toBe(true);
    expect(matchesReuseGlob("src/a.js", "src/*.ts")).toBe(false);
  });

  it("matches ** across segments", () => {
    expect(matchesReuseGlob("src/sub/deep/a.ts", "src/**")).toBe(true);
    expect(matchesReuseGlob("lib/x/y.php", "**/*.php")).toBe(true);
    expect(matchesReuseGlob("lib/x/y.php", "**")).toBe(true);
  });

  it("treats \\* as a literal asterisk and dots literally", () => {
    expect(matchesReuseGlob("a*.ts", "a\\*.ts")).toBe(true);
    expect(matchesReuseGlob("ab.ts", "a\\*.ts")).toBe(false);
    expect(matchesReuseGlob("axts", "a.ts")).toBe(false);
  });

  it("reads path as string or array from annotations that set a licence", () => {
    const toml = [
      "version = 1",
      "",
      "[[annotations]]",
      'path = "src/**"',
      'SPDX-FileCopyrightText = "2024 Example"',
      'SPDX-License-Identifier = "EUPL-1.2"',
      "",
      "[[annotations]]",
      "path = [",
      '  "lib/*.php",',
      "  'css/**',",
      "]",
      'SPDX-License-Identifier = "MIT"',
      "",
      "[[annotations]]",
      'path = "docs/**"',
      'SPDX-FileCopyrightText = "2024 Example"',
    ].join("\n");
    expect(parseReuseTomlPaths(toml)).toEqual(["src/**", "lib/*.php", "css/**"]);
  });
});

describe(".reuse/dep5", () => {
  it("reads Files patterns of paragraphs with a License field", () => {
    const dep5 = [
      "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/",
      "Upstream-Name: example",
      "",
      "Files: src/*",
      " lib/*.php",
      "Copyright: 2024 Example",
      "License: EUPL-1.2",
      "",
      "Files: docs/*",
      "Copyright: 2024 Example",
    ].join("\n");
    expect(parseDep5Patterns(dep5)).toEqual(["src/*", "lib/*.php"]);
  });

  it("lets * cross directories", () => {
    expect(matchesDep5Pattern("src/sub/a.ts", "src/*")).toBe(true);
    expect(matchesDep5Pattern("lib/a.php", "src/*")).toBe(false);
  });
});

describe("shareToStars and starsToStatus", () => {
  it.each([
    [1, 5],
    [0.9999, 4],
    [0.95, 4],
    [0.9499, 3],
    [0.8, 3],
    [0.7999, 2],
    [0.5, 2],
    [0.4999, 1],
    [0, 1],
  ])("rates share %s as %s stars", (share, stars) => {
    expect(shareToStars(share)).toBe(stars);
  });

  it("passes on 5 and 4 stars, warns on 3 and fails below", () => {
    expect(starsToStatus(5)).toBe("pass");
    expect(starsToStatus(4)).toBe("pass");
    expect(starsToStatus(3)).toBe("warn");
    expect(starsToStatus(2)).toBe("fail");
    expect(starsToStatus(1)).toBe("fail");
  });

  it("never rounds a share up to 100%", () => {
    expect(formatShare(0.9996)).toBe("99.9%");
    expect(formatShare(1)).toBe("100.0%");
  });
});

describe("evaluateSpdxCoverage", () => {
  it("warns when there are no source files", () => {
    const result = evaluateSpdxCoverage({
      trackedFiles: ["README.md"],
      filesWithHeader: new Set(),
      reuseTomlGlobs: [],
      dep5Patterns: [],
    });
    expect(result.id).toBe("spdxheaders");
    expect(result.status).toBe("warn");
  });

  it("counts headers, REUSE.toml, dep5 and .license sidecars as covered", () => {
    const result = evaluateSpdxCoverage({
      trackedFiles: ["a.ts", "src/b.ts", "lib/c.php", "d.js", "d.js.license"],
      filesWithHeader: new Set(["a.ts"]),
      reuseTomlGlobs: ["src/**"],
      dep5Patterns: ["lib/*"],
    });
    expect(result.status).toBe("pass");
    expect(result.starRating).toBe(5);
    expect(result.message).toBe("100.0% of 4 source files carry an SPDX header (5 of 5 stars).");
    expect(result.evidence).toEqual([]);
  });

  it("lists at most 20 uncovered files and puts the stars in the message", () => {
    const trackedFiles = Array.from({ length: 30 }, (_, i) => `src/f${i}.ts`);
    const result = evaluateSpdxCoverage({
      trackedFiles,
      filesWithHeader: new Set(trackedFiles.slice(0, 5)),
      reuseTomlGlobs: [],
      dep5Patterns: [],
    });
    expect(result.status).toBe("fail");
    expect(result.starRating).toBe(1);
    expect(result.message).toContain("16.6% of 30 source files carry an SPDX header (1 of 5 stars)");
    expect(result.evidence).toHaveLength(20);
    expect(result.evidence?.[0]).toBe("src/f5.ts");
  });

  it("warns at three stars", () => {
    const trackedFiles = Array.from({ length: 10 }, (_, i) => `f${i}.py`);
    const result = evaluateSpdxCoverage({
      trackedFiles,
      filesWithHeader: new Set(trackedFiles.slice(0, 8)),
      reuseTomlGlobs: [],
      dep5Patterns: [],
    });
    expect(result.status).toBe("warn");
    expect(result.starRating).toBe(3);
    expect(result.message).toContain("(3 of 5 stars)");
  });
});

describe("checkSpdxHeaders", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("warns when there is no local clone", async () => {
    const result = await checkSpdxHeaders(undefined);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("could not be cloned");
  });

  it("rates the git-tracked files of a local clone", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "spdx-headers-"));
    await mkdir(path.join(dir, "src"));
    await mkdir(path.join(dir, "docs"));
    await writeFile(path.join(dir, "src/a.ts"), "// SPDX-License-Identifier: EUPL-1.2\nexport {};\n");
    await writeFile(path.join(dir, "src/b.ts"), "export {};\n");
    await writeFile(path.join(dir, "docs/c.js"), "export {};\n");
    await writeFile(path.join(dir, "untracked.ts"), "export {};\n");
    await writeFile(
      path.join(dir, "REUSE.toml"),
      'version = 1\n\n[[annotations]]\npath = "docs/**"\nSPDX-License-Identifier = "EUPL-1.2"\n'
    );
    execFileSync("git", ["-C", dir, "init", "-q"]);
    execFileSync("git", ["-C", dir, "add", "src", "docs", "REUSE.toml"]);

    const result = await checkSpdxHeaders(dir);
    expect(result.status).toBe("fail");
    expect(result.starRating).toBe(2);
    expect(result.message).toContain("66.6% of 3 source files carry an SPDX header (2 of 5 stars)");
    expect(result.evidence).toEqual(["src/b.ts"]);
  });
});
