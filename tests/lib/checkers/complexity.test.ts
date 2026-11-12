import { describe, expect, it } from "vitest";
import { LIZARD_EXCLUDES } from "@/lib/checkers/complexity";

describe("complexity scope", () => {
  it("skips dependencies, build caches and test stubs", () => {
    expect(LIZARD_EXCLUDES).toEqual(["*/node_modules/*", "*/.next/*", "*/.git/*", "*/tests/stubs/*"]);
  });
});
