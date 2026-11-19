import { describe, expect, it } from "vitest";
import {
  DEFAULT_KPI_TARGETS,
  DEFAULT_SLA_LABELS,
  DEFAULT_SLA_TERMS,
  effectiveSlaLabels,
  parseKpiTargets,
  parseSlaTerms,
  readSlaLabelsOption,
} from "@/lib/maintenanceTerms";

describe("effectiveSlaLabels", () => {
  it("uses GitHub's default labels, so a repository needs no setup", () => {
    expect(effectiveSlaLabels()).toEqual(DEFAULT_SLA_LABELS);
    expect(DEFAULT_SLA_LABELS.bug).toBe("bug");
    expect(DEFAULT_SLA_LABELS.enhancement).toBe("feature-request");
    expect(DEFAULT_SLA_LABELS.wontfix).toBe("no-fix-term");
  });

  it("puts a repository's labels on top, lower case, and switches labels off with ignore", () => {
    const labels = effectiveSlaLabels({ "Type: Bug": "bug", P0: "blocking-bug", enhancement: "ignore", x: "urgent" });
    expect(labels["type: bug"]).toBe("bug");
    expect(labels.p0).toBe("blocking-bug");
    expect(labels).not.toHaveProperty("enhancement");
    expect(labels).not.toHaveProperty("x");
  });
});

describe("parsing the backend's values", () => {
  it("puts valid KPI targets on top of the defaults", () => {
    expect(parseKpiTargets({ "release-frequency": { min: 6 }, bad: { min: -1 } })).toEqual({
      ...DEFAULT_KPI_TARGETS,
      "release-frequency": { min: 6 },
    });
    expect(parseKpiTargets(undefined)).toEqual(DEFAULT_KPI_TARGETS);
  });

  it("puts valid SLA terms on top of the defaults", () => {
    const terms = parseSlaTerms({
      bug: { respondDays: 3, fixDays: 20 },
      question: { respondDays: 0, fixDays: null },
      urgent: { respondDays: 1, fixDays: 1 },
    });
    expect(terms.bug).toEqual({ respondDays: 3, fixDays: 20 });
    expect(terms.question).toEqual(DEFAULT_SLA_TERMS.question);
    expect(terms).not.toHaveProperty("urgent");
  });

  it("reads a label map from a check request", () => {
    expect(readSlaLabelsOption({ blocker: "blocking-bug", n: 1 })).toEqual({ blocker: "blocking-bug" });
    expect(readSlaLabelsOption(["bug"])).toBeNull();
    expect(readSlaLabelsOption(undefined)).toBeNull();
  });
});
