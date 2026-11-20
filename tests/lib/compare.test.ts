import { describe, expect, it } from "vitest";
import {
  compareAspectRatings,
  compareCategoryRatings,
  compareCriteria,
  compareHref,
  compareRatings,
  parseComponentKey,
  tallyWinners,
  type ComparedAnalysis,
} from "@/lib/compare";

function analysis(overrides: Partial<ComparedAnalysis> = {}): ComparedAnalysis {
  return { rating: null, categoryRatings: null, aspectRatings: null, results: [], ...overrides };
}

describe("compareRatings", () => {
  it("marks the higher rating as better", () => {
    expect(compareRatings(4.2, 3.1)).toBe("a");
    expect(compareRatings(2.0, 3.1)).toBe("b");
  });

  it("calls ratings equal when they show the same", () => {
    expect(compareRatings(3.42, 3.44)).toBe("equal");
  });

  it("cannot compare a missing or out-of-range rating", () => {
    expect(compareRatings(null, 3)).toBe("not-comparable");
    expect(compareRatings(3, undefined)).toBe("not-comparable");
    expect(compareRatings(9, 3)).toBe("not-comparable");
  });
});

describe("compareCriteria", () => {
  const a = analysis({
    results: [
      { id: "license", title: "License", status: "pass", message: "EUPL" },
      { id: "maintainability", title: "Maintainability", status: "warn", message: "", rating: 3.4 },
      { id: "standards", title: "Supported standards", status: "info", message: "" },
      { id: "helmchart", title: "Helm chart", status: "fail", message: "", notApplicable: true },
      { id: "sbom", title: "SBOM", status: "pass", message: "" },
    ],
  });
  const b = analysis({
    results: [
      { id: "license", title: "License", status: "fail", message: "None" },
      { id: "maintainability", title: "Maintainability", status: "pass", message: "", rating: 4.6 },
      { id: "standards", title: "Supported standards", status: "info", message: "" },
      { id: "helmchart", title: "Helm chart", status: "pass", message: "" },
    ],
  });

  it("marks the better side per criterion", () => {
    const rows = Object.fromEntries(compareCriteria(a, b).map((row) => [row.id, row.winner]));
    expect(rows).toEqual({
      license: "a",
      maintainability: "b",
      standards: "not-comparable",
      helmchart: "not-comparable",
      sbom: "not-comparable",
    });
  });

  it("keeps each side's result, and none for a criterion it did not measure", () => {
    const sbom = compareCriteria(a, b).find((row) => row.id === "sbom");
    expect(sbom?.a).toEqual({ status: "pass", rating: 5.5, message: "" });
    expect(sbom?.b).toBeNull();
  });

  it("tallies the winners", () => {
    expect(tallyWinners(compareCriteria(a, b))).toEqual({ a: 1, b: 1, equal: 0, "not-comparable": 3 });
  });
});

describe("compareCategoryRatings and compareAspectRatings", () => {
  it("compares the overall rating and each category", () => {
    const rows = compareCategoryRatings(
      analysis({ rating: 3.5, categoryRatings: { Governance: 4, Security: 2 } }),
      analysis({ rating: 3.5, categoryRatings: { Governance: 3, Security: 2.5 } })
    );
    expect(rows[0]).toEqual({ id: "overall", title: "Overall rating", a: 3.5, b: 3.5, winner: "equal" });
    expect(rows.find((row) => row.id === "Governance")?.winner).toBe("a");
    expect(rows.find((row) => row.id === "Security")?.winner).toBe("b");
    expect(rows.find((row) => row.id === "Architecture")?.winner).toBe("not-comparable");
  });

  it("compares AI readiness in a row marked informative", () => {
    const rows = compareCategoryRatings(
      analysis({ categoryRatings: { "AI readiness": 4.2 } }),
      analysis({ categoryRatings: { "AI readiness": 1.5 } })
    );
    expect(rows.find((row) => row.id === "AI readiness")).toMatchObject({
      title: "AI readiness (informative)",
      winner: "a",
    });
  });

  it("compares every aspect of the model", () => {
    const groups = compareAspectRatings(
      analysis({ aspectRatings: { licensing: { rating: 5.5 } } }),
      analysis({ aspectRatings: { licensing: { rating: 1 } } })
    );
    const licensing = groups.flatMap((group) => group.rows).find((row) => row.id === "licensing");
    expect(licensing).toMatchObject({ a: 5.5, b: 1, winner: "a" });
  });
});

describe("parseComponentKey and compareHref", () => {
  it("reads owner/repo, with a GitLab group path as owner", () => {
    expect(parseComponentKey("open-zaak/open-zaak")).toEqual({ owner: "open-zaak", repo: "open-zaak" });
    expect(parseComponentKey("rinis-oss/fsc/open-fsc")).toEqual({ owner: "rinis-oss/fsc", repo: "open-fsc" });
    expect(parseComponentKey(["a/b", "c/d"])).toEqual({ owner: "a", repo: "b" });
  });

  it("rejects what is not owner/repo", () => {
    expect(parseComponentKey("open-zaak")).toBeNull();
    expect(parseComponentKey("/open-zaak")).toBeNull();
    expect(parseComponentKey("")).toBeNull();
    expect(parseComponentKey(undefined)).toBeNull();
  });

  it("builds a readable, shareable URL", () => {
    expect(compareHref({ owner: "open-zaak", repo: "open-zaak" }, { owner: "rinis-oss/fsc", repo: "open-fsc" })).toBe(
      "/compare?a=open-zaak/open-zaak&b=rinis-oss/fsc/open-fsc"
    );
    expect(compareHref(null, null)).toBe("/compare");
  });
});
