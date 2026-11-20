import { describe, expect, it } from "vitest";
import { ASPECT_MODEL, type AspectDefinition } from "@/lib/aspects";
import {
  STAR_BOUNDARIES,
  aspectComposition,
  aspectNote,
  aspectsOfCategory,
  categoryDocSlug,
  documentCountText,
  meterLabel,
  ratingPercent,
  tickPercents,
} from "@/lib/componentRating";
import { CATEGORY_ORDER } from "@/lib/criteria";
import { findCategoryDoc } from "@/lib/ratingDocs";
import type { CheckResult, MeasurementGroup } from "@/lib/types";

function result(id: string, status: CheckResult["status"], extra: Partial<CheckResult> = {}): CheckResult {
  return { id, title: `${id} title`, description: "", status, message: "", ...extra };
}

function aspect(id: string): AspectDefinition {
  const found = ASPECT_MODEL.flatMap((category) => category.aspects).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No aspect ${id}`);
  return found;
}

const UNIT_SIZE: MeasurementGroup = {
  id: "unit-size",
  title: "Unit size",
  aspects: ["analysability", "reusability"],
  rows: [{ label: "Python, more than 15 lines", value: "58.8%", thresholds: { 4: "≤ 48.0%" }, stars: 3 }],
};

describe("bar geometry", () => {
  it.each([
    [0.5, 0],
    [5.5, 100],
    [5, 90],
    [3, 50],
    [1.8, 26],
    [0, 0],
    [6, 100],
    [null, 0],
  ])("puts %s at %s%% of the bar", (rating, percent) => {
    expect(ratingPercent(rating)).toBe(percent);
  });

  it("puts a tick at each star boundary", () => {
    expect(STAR_BOUNDARIES).toEqual([1.5, 2.5, 3.5, 4.5]);
    expect(tickPercents()).toEqual([20, 40, 60, 80]);
  });

  it("labels the meter with the aspect, its rating and the maximum", () => {
    expect(meterLabel("Testability", 1.76)).toBe("Testability 1.8 of 5.5");
  });
});

describe("documentCountText", () => {
  it("counts the documents found", () => {
    expect(documentCountText({ rating: 4, found: 4, expected: 5 })).toBe("4 of 5 found");
  });

  it("is null for an aspect that is not a document count", () => {
    expect(documentCountText({ rating: 3.2 })).toBeNull();
    expect(documentCountText(undefined)).toBeNull();
  });
});

describe("categoryDocSlug", () => {
  it("finds a page in the rating guide for every category", () => {
    for (const category of CATEGORY_ORDER) {
      const slug = categoryDocSlug(category);
      expect(slug && findCategoryDoc(slug), category).toBeTruthy();
    }
    expect(categoryDocSlug("Deployment & Operations")).toBe("deployment-operations");
  });

  it("gives every category its aspects from the model", () => {
    expect(aspectsOfCategory("Governance").map((entry) => entry.id)).toEqual([
      "licensing",
      "ownership",
      "maintenance",
      "community-documents",
      "usage-and-ecosystem",
      "project-health",
    ]);
  });
});

describe("aspectComposition", () => {
  it("shows the measurements a check reports for the aspect", () => {
    const results = [result("maintainability", "fail", { measurements: [UNIT_SIZE] })];

    expect(aspectComposition(aspect("analysability"), results)).toEqual({ type: "measurements", groups: [UNIT_SIZE] });
    expect(aspectComposition(aspect("testability"), results)).toMatchObject({ type: "criteria" });
  });

  it("shows the check itself when it has no measurements", () => {
    const composition = aspectComposition(aspect("testability"), [result("maintainability", "warn", { rating: 2.9 })]);

    expect(composition).toEqual({
      type: "criteria",
      criteria: [{ id: "maintainability", title: "maintainability title", status: "warn", rating: 2.9, hasCard: true }],
    });
  });

  it("shows the usage sources of an informative aspect, in the order of their kind", () => {
    const declared = {
      id: "publiccode-usedby", kind: "declared" as const, source: "publiccode.yml usedBy", subject: null, url: null,
      measuredAt: "2026-11-18", caveat: "Self-declared.", figures: [{ label: "organisations named", value: 2 }],
    };
    const pulls = { ...declared, id: "dockerhub:a/b", kind: "containers" as const, source: "Docker Hub" };
    const composition = aspectComposition(aspect("usage-and-ecosystem"), [
      result("usage", "info", { usage: { sources: [pulls, declared] } }),
    ]);

    expect(composition).toEqual({ type: "usage", sources: [declared, pulls] });
    expect(aspectComposition(aspect("usage-and-ecosystem"), [])).toEqual({ type: "usage", sources: [] });
  });

  it("shows the metrics of an informative aspect", () => {
    const metric = {
      id: "release-frequency",
      name: "Release Frequency",
      referenceUrl: "https://chaoss.community/kb/metric-release-frequency/",
      value: "4 in 12 months",
      explanation: "Four releases.",
    };

    expect(aspectComposition(aspect("project-health"), [result("projecthealth", "info", { metrics: [metric] })])).toEqual({
      type: "metrics",
      metrics: [metric],
    });
    expect(aspectComposition(aspect("project-health"), [])).toEqual({ type: "metrics", metrics: [] });
  });

  it("shows the size a check measured, or its message when it was not measured", () => {
    const size = { tool: "scc 4.1.0", files: 1, loc: 10, languages: [{ language: "PHP", family: "php" as const, files: 1, loc: 10 }] };

    expect(aspectComposition(aspect("size"), [result("size", "info", { size, message: "10 lines" })])).toEqual({
      type: "size",
      size,
      message: "10 lines",
    });
    expect(aspectComposition(aspect("size"), [result("size", "info", { message: "Not measured: no clone." })])).toEqual({
      type: "size",
      size: null,
      message: "Not measured: no clone.",
    });
    expect(aspectComposition(aspect("size"), [])).toEqual({ type: "size", size: null, message: null });
  });

  it("lists the documents of a document-count aspect", () => {
    const composition = aspectComposition(aspect("community-documents"), [
      result("documentation", "pass"),
      result("contributing", "fail"),
    ]);

    expect(composition.type).toBe("documents");
    expect(composition.type === "documents" && composition.criteria.map((entry) => [entry.id, entry.status])).toEqual([
      ["documentation", "pass"],
      ["contributing", "fail"],
    ]);
  });

  it("rates each criterion of a normal aspect and leaves out criteria that did not run", () => {
    const composition = aspectComposition(aspect("licensing"), [result("license", "pass"), result("spdxheaders", "info")]);

    expect(composition).toEqual({
      type: "criteria",
      criteria: [
        { id: "license", title: "license title", status: "pass", rating: 5.5, hasCard: true },
        { id: "spdxheaders", title: "spdxheaders title", status: "info", rating: null, hasCard: true },
      ],
    });
  });
});

describe("aspectNote", () => {
  it("says not counted for a rated aspect with weight 0", () => {
    expect(aspectNote({ id: "layering", title: "Layering", source: { type: "criteria", checkIds: ["fivelayer"] }, weight: 0 })).toBe(
      "not counted"
    );
  });

  it("adds no note to a counted aspect", () => {
    expect(aspectNote({ id: "api", title: "API", source: { type: "criteria", checkIds: ["openapi"] } })).toBeNull();
  });

  it("says informative, not rated for an aspect whose source gives no stars", () => {
    const aspect = { id: "size", title: "Size", source: { type: "size", checkId: "size" }, weight: 0 };
    expect(aspectNote(aspect as unknown as AspectDefinition)).toBe("informative, not rated");
  });
});
