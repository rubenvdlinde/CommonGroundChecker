import { describe, expect, it } from "vitest";
import {
  checkOpenSourceHealth,
  mapOpenSourceHealthReport,
  openSourceHealthMeasurements,
  type OpenSourceHealthReport,
} from "@/lib/checkers/openSourceHealth";
import { measurementsForAspect, parseMeasurements } from "@/lib/measurements";
import { ASPECT_MODEL } from "@/lib/aspects";
import { aspectComposition } from "@/lib/componentRating";
import fixture from "../../fixtures/open-source-health-report.json";

const report = fixture as unknown as OpenSourceHealthReport;

describe("mapOpenSourceHealthReport", () => {
  it("warns on a real report rated 2.57, 3 stars, and lists every property", () => {
    const result = mapOpenSourceHealthReport(report);

    expect(result.id).toBe("opensourcehealth");
    expect(result.status).toBe("warn");
    expect(result.starRating).toBe(3);
    expect(result.rating).toBe(2.57);
    expect(result.message).toContain("840 production dependencies");
    expect(result.evidence).toContain("Vulnerabilities: ★☆☆☆☆ 1 critical, 9 high, 4 moderate");
    expect(result.evidence).toContain("Licence use: ★☆☆☆☆ 5 critical, 0 high, 16 medium, 0 low risk");
    expect(result.evidence).toContain("Management: ★★★★★ 0 unmanaged of 840 dependencies");
  });

  it("reports each property's continuous rating as an aspect rating", () => {
    expect(mapOpenSourceHealthReport(report).aspectRatings).toEqual({
      vulnerabilities: 1,
      freshness: 3.36,
      activity: 1.98,
      licence: 1,
      management: 5.5,
    });
  });

  it("falls back to a property's stars and leaves out the rating in a report without ratings", () => {
    const withoutRatings: OpenSourceHealthReport = {
      ...report,
      overall: 2,
      overall_rating: undefined,
      properties: Object.fromEntries(
        Object.entries(report.properties).map(([key, property]) => [key, { ...property, rating: undefined }])
      ),
    };
    const result = mapOpenSourceHealthReport(withoutRatings);

    expect(result.aspectRatings).toEqual({ vulnerabilities: 1, freshness: 3, activity: 2, licence: 1, management: 5 });
    expect(result.starRating).toBe(2);
    expect(result.rating).toBeUndefined();
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

describe("openSourceHealthMeasurements", () => {
  const groups = openSourceHealthMeasurements(report);
  const group = (id: string) => groups.find((candidate) => candidate.id === id)!;

  it("gives one group per property, keyed by its aspect", () => {
    expect(groups.map(({ id, aspects }) => [id, aspects])).toEqual([
      ["vulnerabilities", ["vulnerabilities"]],
      ["freshness", ["freshness"]],
      ["activity", ["activity"]],
      ["licence", ["licence"]],
      ["management", ["management"]],
    ]);
    expect(mapOpenSourceHealthReport(report).measurements).toEqual(groups);
  });

  it("shows the freshness shares per bound against the thresholds of each level", () => {
    const rows = group("freshness").rows;

    expect(rows.map((row) => row.label)).toEqual([
      "> 1 year",
      "> 2 years",
      "> 3.5 years",
      "> 5 years, absolute bound",
    ]);
    expect(rows[0]).toEqual({
      label: "> 1 year",
      value: "24.5%",
      thresholds: { 5: "≤ 17.1%", 4: "≤ 34.2%", 3: "≤ 68.4%", 2: "any" },
      stars: 4,
    });
    expect(rows[2].stars).toBe(3);
    expect(rows[3]).toEqual({
      label: "> 5 years, absolute bound",
      value: "75 dependencies",
      thresholds: { 5: "none", 4: "none", 3: "any", 2: "any" },
      stars: null,
      starsText: "caps at 3 stars",
    });
  });

  it("uses the activity bounds of the report", () => {
    const rows = group("activity").rows;

    expect(rows.map((row) => row.label)).toEqual([
      "> 1 year",
      "> 2 years",
      "> 4 years",
      "> 5.5 years, absolute bound",
    ]);
    expect(rows[2]).toMatchObject({ value: "21.7%", stars: 2 });
  });

  it("counts vulnerabilities per severity against what each level allows", () => {
    const rows = group("vulnerabilities").rows;

    expect(rows[0]).toEqual({
      label: "Critical or high",
      value: "10",
      thresholds: { 5: "none", 4: "none", 3: "≤ 2", 2: "≤ 5" },
      stars: 1,
    });
    expect(rows[1]).toMatchObject({ label: "Moderate", value: "4", stars: 4 });
    expect(rows[2]).toMatchObject({ label: "Low", value: "3", stars: null, starsText: "not rated" });
  });

  it("counts licences per risk class against what each level allows", () => {
    const rows = group("licence").rows;

    expect(rows.map(({ label, value, stars }) => [label, value, stars])).toEqual([
      ["Critical risk", "5", 1],
      ["High risk", "0", 5],
      ["Medium risk", "16", 3],
      ["Low risk", "0", 5],
    ]);
    expect(rows[3].thresholds).toEqual({ 5: "none", 4: "≤ 3", 3: "any", 2: "any" });
  });

  it("shows the unmanaged share", () => {
    expect(group("management").rows).toEqual([
      {
        label: "Unmanaged third-party code",
        value: "0.0%",
        thresholds: { 5: "none", 4: "≤ 6.0%", 3: "≤ 12.0%", 2: "≤ 24.0%" },
        stars: 5,
      },
    ]);
  });

  it("survives storing and reading back, and is found per aspect", () => {
    const stored = parseMeasurements(JSON.parse(JSON.stringify(groups)));

    expect(stored).toEqual(groups);
    expect(measurementsForAspect(stored, "freshness").map((found) => found.id)).toEqual(["freshness"]);
  });

  it("feeds the threshold table of every Open Source Health aspect in Security", () => {
    const result = mapOpenSourceHealthReport(report);
    const security = ASPECT_MODEL.find((entry) => entry.category === "Security")!;
    const healthAspects = security.aspects.filter(
      (aspect) => aspect.source.type === "check-aspect" && aspect.source.checkId === "opensourcehealth"
    );

    expect(healthAspects).toHaveLength(5);
    for (const aspect of healthAspects) {
      const composition = aspectComposition(aspect, [result]);
      expect(composition.type).toBe("measurements");
    }
  });

  it("gives no measurements for a report without bands or for an unrated property", () => {
    expect(openSourceHealthMeasurements({ ...report, bands: undefined })).toEqual([]);
    const unrated = {
      ...report,
      properties: { ...report.properties, vulnerabilities: { stars: null, detail: null, affected: null } },
    };
    expect(openSourceHealthMeasurements(unrated).map((found) => found.id)).not.toContain("vulnerabilities");
  });
});

describe("checkOpenSourceHealth", () => {
  it("warns without a cloned repository", async () => {
    expect((await checkOpenSourceHealth(undefined)).status).toBe("warn");
  });
});
