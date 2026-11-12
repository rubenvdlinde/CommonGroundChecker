import { describe, expect, it } from "vitest";
import { isUnmeasured, parseArgs } from "../../scripts/scan-local";

describe("parseArgs", () => {
  it("reads the checkout and the options", () => {
    expect(parseArgs(["/x", "--owner", "O", "--repo", "R", "--register", "--api-spec", "a.yaml", "--api-spec", "b.yaml", "--scoring", "s.json", "--full"])).toEqual({
      checkout: "/x",
      owner: "O",
      repo: "R",
      register: true,
      scoring: "s.json",
      apiSpecs: ["a.yaml", "b.yaml"],
      full: true,
    });
  });

  it("refuses a missing checkout, an unknown option and a flag without a value", () => {
    expect(() => parseArgs([])).toThrow(/checkout/);
    expect(() => parseArgs(["/x", "--bogus"])).toThrow(/unknown option/);
    expect(() => parseArgs(["/x", "--owner"])).toThrow(/needs a value/);
    expect(() => parseArgs(["/x", "/y"])).toThrow(/unexpected argument/);
  });
});

describe("isUnmeasured", () => {
  it("flags a criterion whose tool or service did not run", () => {
    expect(isUnmeasured("Lizard is not installed on the checker host. Install it.")).toBe(true);
    expect(isUnmeasured("Secret scanning could not run.")).toBe(true);
    expect(isUnmeasured("The OpenSSF Scorecard could not be retrieved.")).toBe(true);
    expect(isUnmeasured("Spectral CLI is not available. Ensure Node.js and npx are installed.")).toBe(true);
  });

  it("does not flag a measured finding", () => {
    expect(isUnmeasured("Gitleaks found 1 potential secret in the working tree.")).toBe(false);
    expect(isUnmeasured("Could not detect a probable copyright owner from repository metadata.")).toBe(false);
    expect(isUnmeasured("No API specification could be resolved for ADR linting.")).toBe(false);
  });
});
