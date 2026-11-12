import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminScoring: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({ getAdminScoring: mocks.getAdminScoring }));

import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID, getActiveScoringConfig, getScoringConfig } from "@/lib/checkers/config";
import { CATEGORY_WEIGHTS } from "@/lib/criteria";

describe("getActiveScoringConfig category weights", () => {
  beforeEach(() => {
    mocks.getAdminScoring.mockReset();
  });

  it("applies a stored Software Quality weight to Maintainability", async () => {
    mocks.getAdminScoring.mockResolvedValue({
      scoringConfigId: "cfg-legacy",
      categoryWeights: {
        Governance: 0.3,
        "Software Quality": 0.4,
      },
    });

    const active = await getActiveScoringConfig();

    expect(active.id).toBe("cfg-legacy");
    expect(active.config.categoryWeights).toEqual({
      ...CATEGORY_WEIGHTS,
      Governance: 0.3,
      Maintainability: 0.4,
    });
    expect(active.config.categoryWeights).not.toHaveProperty("Software Quality");
  });

  it("prefers a stored Maintainability weight over Software Quality", async () => {
    mocks.getAdminScoring.mockResolvedValue({
      scoringConfigId: "cfg-both",
      categoryWeights: {
        Maintainability: 0.1,
        "Software Quality": 0.4,
      },
    });

    const active = await getActiveScoringConfig();

    expect(active.config.categoryWeights.Maintainability).toBe(0.1);
  });

  it("uses the default Maintainability weight without a backend", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAdminScoring.mockRejectedValue(new Error("offline"));

    const active = await getActiveScoringConfig();

    expect(active.id).toBeNull();
    expect(active.config.categoryWeights.Maintainability).toBe(0.15);
  });
});

describe("complexity requirement level", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.getAdminScoring.mockReset();
  });

  it("defaults to informative with no weight", () => {
    expect(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID.complexity).toEqual({
      weight: 0,
      requirementLevel: "informative",
    });
  });

  it("stays informative when the stored config still marks it mandatory", async () => {
    mocks.getAdminScoring.mockResolvedValue({
      scoringConfigId: "cfg-1",
      criterionWeights: { complexity: 1 },
      criterionRequirementLevels: { complexity: "mandatory" },
    });

    const config = await getScoringConfig();

    expect(config.criterionConfigByCheckId.complexity).toEqual({
      weight: 0,
      requirementLevel: "informative",
    });
  });

  it("is informative when the scoring config cannot be loaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAdminScoring.mockRejectedValue(new Error("offline"));

    const config = await getScoringConfig();

    expect(config.criterionConfigByCheckId.complexity.requirementLevel).toBe("informative");
  });
});
