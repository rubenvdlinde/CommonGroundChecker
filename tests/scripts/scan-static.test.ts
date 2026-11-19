import { describe, expect, it } from "vitest";
import { parseStaticScanArgs } from "../../scripts/scan-static";

describe("parseStaticScanArgs", () => {
  it("has defaults for a nightly run", () => {
    expect(parseStaticScanArgs([])).toEqual({ data: "data", only: [], indexOnly: false, full: false, concurrency: 1, timeoutMinutes: 45 });
  });

  it("reads every option", () => {
    expect(
      parseStaticScanArgs([
        "--data", "examples/static-data", "--only", "https://github.com/a/b", "--only", "https://github.com/a/c",
        "--index-only", "--scoring", "scoring.json", "--concurrency", "3", "--timeout-minutes", "20", "--full",
      ])
    ).toEqual({
      data: "examples/static-data",
      only: ["https://github.com/a/b", "https://github.com/a/c"],
      indexOnly: true,
      full: true,
      scoring: "scoring.json",
      concurrency: 3,
      timeoutMinutes: 20,
    });
  });

  it("rejects unknown arguments and bad numbers", () => {
    expect(() => parseStaticScanArgs(["--fast"])).toThrow(/unknown argument/);
    expect(() => parseStaticScanArgs(["--concurrency", "0"])).toThrow(/whole number/);
    expect(() => parseStaticScanArgs(["--only"])).toThrow(/needs a value/);
  });
});
