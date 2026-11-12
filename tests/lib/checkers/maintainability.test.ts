import { describe, expect, it } from "vitest";
import {
  checkMaintainability,
  mapMaintainabilityReport,
  type MaintainabilityReport,
} from "@/lib/checkers/maintainability";
import fixture from "../../fixtures/maintainability-report.json";

const report = fixture as unknown as MaintainabilityReport;

function withOverall(low: number, high: number): MaintainabilityReport {
  return { ...report, rating: { ...report.rating, overall: { range: [low, high] } } };
}

describe("mapMaintainabilityReport", () => {
  it("fails a real report rated about 2 stars and lists its rated properties", () => {
    const result = mapMaintainabilityReport(report);

    expect(result.id).toBe("maintainability");
    expect(result.status).toBe("fail");
    expect(result.starRating).toBe(2);
    expect(result.message).toContain("1.98 to 2.16");
    expect(result.evidence).toContain("Unit size: ★★☆☆☆ 1.5 (javascript 5.5, typescript 1.5)");
    expect(result.evidence?.some((line) => line.startsWith("Module coupling"))).toBe(false);
  });

  it("lists the three biggest levers with their effort", () => {
    const levers = mapMaintainabilityReport(report).evidence?.filter((line) => line.startsWith("Lever:"));

    expect(levers).toHaveLength(3);
    expect(levers?.[0]).toBe("Lever: unit complexity in typescript, about 188 lines to fix for half a star");
  });

  it.each([
    [3.4, 3.6, "pass", 4],
    [2.6, 3.0, "warn", 3],
    [4.8, 5.4, "pass", 5],
    [0.5, 0.7, "fail", 1],
  ])("rates %s to %s as %s with %s stars", (low, high, status, stars) => {
    const result = mapMaintainabilityReport(withOverall(low, high));

    expect(result.status).toBe(status);
    expect(result.starRating).toBe(stars);
  });

  it("warns when there is nothing to rate", () => {
    const result = mapMaintainabilityReport({ ...report, rating: { ...report.rating, overall: null } });

    expect(result.status).toBe("warn");
    expect(result.starRating).toBeUndefined();
  });
});

describe("checkMaintainability", () => {
  it("warns without a cloned repository", async () => {
    const result = await checkMaintainability(undefined);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("could not be cloned");
  });
});
