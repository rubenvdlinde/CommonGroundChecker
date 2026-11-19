import { describe, expect, it } from "vitest";
import { measurementsForAspect, parseMeasurements, parseMetrics } from "@/lib/measurements";
import { mapMaintainabilityReport, type MaintainabilityReport } from "@/lib/checkers/maintainability";
import openZaakFixture from "../fixtures/maintainability-report-open-zaak.json";

describe("parseMeasurements", () => {
  it("reads back the measurements of a stored maintainability result", () => {
    const { measurements } = mapMaintainabilityReport(openZaakFixture as unknown as MaintainabilityReport);
    const stored = JSON.parse(JSON.stringify(measurements));

    expect(parseMeasurements(stored)).toEqual(measurements);
  });

  it("leaves out malformed groups, rows, thresholds and stars", () => {
    const parsed = parseMeasurements([
      { id: "freshness", title: "Dependency freshness", aspects: ["freshness", 3], rows: [
        { label: "> 1 year", value: "24.5%", thresholds: { 4: "≤ 20%", 1: "x", 3: 7 }, stars: 9 },
        { label: "no value" },
      ] },
      { id: "empty", title: "Empty", aspects: [], rows: [] },
      { title: "No id", rows: [] },
      "nonsense",
    ]);

    expect(parsed).toEqual([
      {
        id: "freshness",
        title: "Dependency freshness",
        aspects: ["freshness"],
        rows: [{ label: "> 1 year", value: "24.5%", thresholds: { 4: "≤ 20%" }, stars: null }],
      },
    ]);
  });

  it("is undefined for a result without measurements", () => {
    expect(parseMeasurements(undefined)).toBeUndefined();
    expect(parseMeasurements([])).toBeUndefined();
  });
});

describe("measurementsForAspect", () => {
  it("picks the groups that count in the aspect", () => {
    const groups = [
      { id: "a", title: "A", aspects: ["testability"], rows: [] },
      { id: "b", title: "B", aspects: ["reusability"], rows: [] },
    ];

    expect(measurementsForAspect(groups, "testability").map((group) => group.id)).toEqual(["a"]);
    expect(measurementsForAspect(undefined, "testability")).toEqual([]);
  });
});

describe("parseMetrics", () => {
  const metric = {
    id: "release-frequency",
    name: "Release Frequency",
    referenceUrl: "https://chaoss.community/kb/metric-release-frequency/",
    value: "4 in 12 months",
    explanation: "Four releases.",
  };

  it("reads back stored metrics, a not measured one included", () => {
    const notMeasured = { ...metric, id: "issue-response-time", value: null, explanation: "Not measured: no issues." };
    expect(parseMetrics([metric, notMeasured])).toEqual([metric, notMeasured]);
  });

  it("leaves out malformed metrics and links that are not https", () => {
    expect(parseMetrics([{ ...metric, value: 4 }, { ...metric, referenceUrl: "javascript:alert(1)" }, "x"])).toBeUndefined();
    expect(parseMetrics(undefined)).toBeUndefined();
  });
});
