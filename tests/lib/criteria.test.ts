import { describe, expect, it } from "vitest";

import {
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  RESULT_CATEGORY_BY_ID,
  RESULT_ORDER_BY_ID,
  migrateLegacyCategoryWeights,
} from "@/lib/criteria";

describe("criteria categories", () => {
  it("orders the five quality aspects", () => {
    expect(CATEGORY_ORDER).toEqual([
      "Governance",
      "Security",
      "Architecture",
      "Maintainability",
      "Deployment & Operations",
    ]);
  });

  it("gives Maintainability the former Software Quality weight", () => {
    expect(CATEGORY_WEIGHTS).toEqual({
      Governance: 0.2,
      Architecture: 0.2,
      Security: 0.25,
      "Deployment & Operations": 0.2,
      Maintainability: 0.15,
    });
  });

  it("assigns every criterion to its quality aspect", () => {
    expect(RESULT_CATEGORY_BY_ID).toMatchObject({
      sourcecode: "Maintainability",
      complexity: "Maintainability",
      tests: "Maintainability",
      coverage: "Maintainability",
      codemetrics: "Maintainability",
      sbom: "Security",
      owaspsecurecoding: "Security",
      security: "Security",
      documentation: "Governance",
      changelog: "Governance",
      semver: "Deployment & Operations",
    });
    for (const id of RESULT_ORDER_BY_ID) {
      expect(CATEGORY_ORDER).toContain(RESULT_CATEGORY_BY_ID[id]);
    }
  });
});

describe("migrateLegacyCategoryWeights", () => {
  it("maps a stored Software Quality weight to Maintainability", () => {
    expect(
      migrateLegacyCategoryWeights({ Governance: 0.3, "Software Quality": 0.4 })
    ).toEqual({ Governance: 0.3, Maintainability: 0.4 });
  });

  it("keeps an existing Maintainability weight over the legacy one", () => {
    expect(
      migrateLegacyCategoryWeights({ Maintainability: 0.1, "Software Quality": 0.4 })
    ).toEqual({ Maintainability: 0.1 });
  });

  it("leaves weights without legacy keys unchanged", () => {
    const weights = { Governance: 0.2, Maintainability: 0.15 };
    expect(migrateLegacyCategoryWeights(weights)).toEqual(weights);
  });
});
