import { describe, expect, it } from "vitest";
import { ASPECT_MODEL, type AspectDefinition } from "@/lib/aspects";
import {
  STAR_BOUNDARIES,
  aspectComposition,
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
      "community-documents",
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

  it("lists the documents of a document-count aspect", () => {
    const composition = aspectComposition(aspect("community-documents"), [
      result("documentation", "pass"),
      result("contributing", "fail"),
    ]);

    expect(composition.type).toBe("documents");
    expect(composition.type !== "measurements" && composition.criteria.map((entry) => [entry.id, entry.status])).toEqual([
      ["documentation", "pass"],
      ["contributing", "fail"],
    ]);
  });

  it("rates each criterion of a normal aspect and leaves out criteria that did not run", () => {
    const composition = aspectComposition(aspect("licensing"), [result("license", "pass"), result("spdxheaders", "info")]);

    expect(composition).toEqual({
      type: "criteria",
      criteria: [
        { id: "license", title: "license title", status: "pass", rating: 5, hasCard: true },
        { id: "spdxheaders", title: "spdxheaders title", status: "info", rating: null, hasCard: true },
      ],
    });
  });
});
