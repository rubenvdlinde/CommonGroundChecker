import { describe, expect, it } from "vitest";
import { EXCLUDED_DIRECTORIES, extractAverageFromFunctionRows, lizardExcludeArgs } from "@/lib/checkers/complexity";

describe("extractAverageFromFunctionRows", () => {
  it("handles more function rows than fit in a spread argument list", () => {
    const rows = Array.from({ length: 200_000 }, (_, i) => `      10      ${i === 123_456 ? 42 : 2}     50      1      12 f${i}@1-12@a.php`);
    const summary = extractAverageFromFunctionRows(["  NLOC    CCN   token  PARAM  length  location  ", ...rows].join("\n"));

    expect(summary).not.toBeNull();
    expect(summary?.functionCount).toBe(200_000);
    expect(summary?.maxCcn).toBe(42);
    expect(summary?.averageCcn).toBeCloseTo((2 * 199_999 + 42) / 200_000);
  });
});

describe("lizardExcludeArgs", () => {
  it("excludes dependency, build and generated output", () => {
    const args = lizardExcludeArgs();

    for (const directory of ["vendor", "node_modules", "dist", "build", "coverage", "generated", ".next", ".git"]) {
      expect(args).toContain(`*/${directory}/*`);
    }
    expect(args).toContain("*.min.js");
  });

  it("passes every pattern as its own -x option", () => {
    const args = lizardExcludeArgs();

    expect(args).toHaveLength((EXCLUDED_DIRECTORIES.length + 1) * 2);
    expect(args.filter((_, index) => index % 2 === 0).every((arg) => arg === "-x")).toBe(true);
  });
});
