import { afterEach, describe, expect, it, vi } from "vitest";

const getAdminScoring = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getAdminScoring }));

import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID, getScoringConfig } from "@/lib/checkers/config";

describe("complexity requirement level", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getAdminScoring.mockReset();
  });

  it("defaults to informative with no weight", () => {
    expect(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID.complexity).toEqual({
      weight: 0,
      requirementLevel: "informative",
    });
  });

  it("stays informative when the stored config still marks it mandatory", async () => {
    getAdminScoring.mockResolvedValue({
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
    getAdminScoring.mockRejectedValue(new Error("offline"));

    const config = await getScoringConfig();

    expect(config.criterionConfigByCheckId.complexity.requirementLevel).toBe("informative");
  });
});
