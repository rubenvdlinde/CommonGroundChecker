import { describe, expect, it } from "vitest";
import {
  checkOpenSourceHealth,
  mapOpenSourceHealthReport,
  type OpenSourceHealthReport,
} from "@/lib/checkers/openSourceHealth";
import fixture from "../../fixtures/open-source-health-report.json";

const report = fixture as unknown as OpenSourceHealthReport;

describe("mapOpenSourceHealthReport", () => {
  it("fails a real report rated 2 stars and lists every property", () => {
    const result = mapOpenSourceHealthReport(report);

    expect(result.id).toBe("opensourcehealth");
    expect(result.status).toBe("fail");
    expect(result.starRating).toBe(2);
    expect(result.message).toContain("840 production dependencies");
    expect(result.evidence).toContain("Vulnerabilities: ★☆☆☆☆ 1 critical, 9 high, 4 moderate");
    expect(result.evidence).toContain("Licence use: ★☆☆☆☆ 5 critical, 0 high, 16 medium, 0 low risk");
    expect(result.evidence).toContain("Management: ★★★★★ 0 unmanaged of 840 dependencies");
  });

  it("reports each property's stars as an aspect rating", () => {
    expect(mapOpenSourceHealthReport(report).aspectRatings).toEqual({
      vulnerabilities: 1,
      freshness: 3,
      activity: 2,
      licence: 1,
      management: 5,
    });
  });

  it("lists the severely vulnerable dependencies", () => {
    const vulnerable = mapOpenSourceHealthReport(report).evidence?.filter((line) => line.startsWith("Vulnerable:"));

    expect(vulnerable?.length).toBeGreaterThan(0);
    expect(vulnerable?.every((line) => /\((high|critical)\)$/.test(line))).toBe(true);
  });

  it.each([
    [5, "pass"],
    [4, "pass"],
    [3, "warn"],
    [1, "fail"],
  ] as const)("maps an overall of %s stars to %s", (stars, status) => {
    expect(mapOpenSourceHealthReport({ ...report, overall: stars }).status).toBe(status);
  });

  it("says when a property could not be rated", () => {
    const unrated = {
      ...report,
      properties: { ...report.properties, vulnerabilities: { stars: null, detail: null, affected: null } },
    };

    expect(mapOpenSourceHealthReport(unrated).evidence).toContain("Vulnerabilities: not rated (data unavailable)");
  });

  it("warns when nothing could be rated", () => {
    const result = mapOpenSourceHealthReport({ ...report, overall: null });

    expect(result.status).toBe("warn");
    expect(result.starRating).toBeUndefined();
  });
});

describe("checkOpenSourceHealth", () => {
  it("warns without a cloned repository", async () => {
    expect((await checkOpenSourceHealth(undefined)).status).toBe("warn");
  });
});
