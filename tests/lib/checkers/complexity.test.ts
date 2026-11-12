import { describe, expect, it } from "vitest";
import { EXCLUDED_DIRECTORIES, lizardExcludeArgs } from "@/lib/checkers/complexity";

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
