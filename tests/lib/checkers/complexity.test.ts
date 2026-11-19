import { describe, expect, it } from "vitest";
import { extractAverageFromFunctionRows } from "@/lib/checkers/complexity";

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
