import { describe, expect, it } from "vitest";
import { meetsTarget, metricAmount, targetText, withKpiTargets } from "@/lib/kpi";
import { DEFAULT_KPI_TARGETS } from "@/lib/maintenanceTerms";
import type { InformativeMetric } from "@/lib/types";

function metric(id: string, value: string | null): InformativeMetric {
  return { id, name: id, referenceUrl: "https://chaoss.community/kb/metric-x/", value, explanation: "" };
}

describe("metricAmount", () => {
  it("reads the amount of each CHAOSS metric from its shown value", () => {
    expect(metricAmount(metric("contributor-absence-factor", "3"))).toBe(3);
    expect(metricAmount(metric("organizational-diversity", "4 organisations; largest 62%"))).toBe(4);
    expect(metricAmount(metric("change-request-closure-ratio", "0.85"))).toBe(0.85);
    expect(metricAmount(metric("release-frequency", "at least 12 in 12 months"))).toBe(12);
  });

  it("reads response times in hours", () => {
    expect(metricAmount(metric("time-to-first-response", "median 45 minutes"))).toBe(0.75);
    expect(metricAmount(metric("time-to-first-response", "median 6.5 hours"))).toBe(6.5);
    expect(metricAmount(metric("issue-response-time", "median 3.2 days"))).toBeCloseTo(76.8);
  });

  it("is null when not measured, without an amount, or for an unknown metric", () => {
    expect(metricAmount(metric("release-frequency", null))).toBeNull();
    expect(metricAmount(metric("issue-response-time", "no response"))).toBeNull();
    expect(metricAmount(metric("something-else", "5"))).toBeNull();
  });
});

describe("meetsTarget", () => {
  it("compares against a minimum and a maximum", () => {
    expect(meetsTarget(metric("release-frequency", "4 in 12 months"), { min: 4 })).toBe(true);
    expect(meetsTarget(metric("release-frequency", "3 in 12 months"), { min: 4 })).toBe(false);
    expect(meetsTarget(metric("time-to-first-response", "median 2.5 days"), { max: 48 })).toBe(false);
    expect(meetsTarget(metric("time-to-first-response", "median 6.5 hours"), { max: 48 })).toBe(true);
  });

  it("counts no response as missing a response time target, and does not compare what was not measured", () => {
    expect(meetsTarget(metric("issue-response-time", "no response"), { max: 120 })).toBe(false);
    expect(meetsTarget(metric("issue-response-time", null), { max: 120 })).toBeNull();
  });
});

describe("targetText", () => {
  it("names the target in the unit of the metric", () => {
    expect(targetText("contributor-absence-factor", { min: 2 })).toBe("at least 2 people");
    expect(targetText("contributor-absence-factor", { min: 1 })).toBe("at least 1 person");
    expect(targetText("time-to-first-response", { max: 48 })).toBe("at most 48 hours");
    expect(targetText("change-request-closure-ratio", { min: 0.8 })).toBe("at least 0.8");
    expect(targetText("release-frequency", { min: 4, max: 52 })).toBe(
      "at least 4 releases in 12 months and at most 52 releases in 12 months"
    );
  });
});

describe("withKpiTargets", () => {
  it("adds the target and whether it is met to the metrics that have one", () => {
    const [absence, other] = withKpiTargets(
      [metric("contributor-absence-factor", "1"), metric("something-else", "5")],
      DEFAULT_KPI_TARGETS
    );
    expect(absence.target).toEqual({ text: "at least 2 people", met: false });
    expect(other.target).toBeUndefined();
  });
});
