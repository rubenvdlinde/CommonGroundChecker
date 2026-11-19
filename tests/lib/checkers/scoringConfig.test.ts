import { afterEach, describe, expect, it, vi } from "vitest";

const getAdminScoring = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getAdminScoring }));

import { getActiveScoringConfig } from "@/lib/checkers/config";
import { DEFAULT_KPI_TARGETS, DEFAULT_SLA_TERMS } from "@/lib/maintenanceTerms";

const response = {
  scoringConfigId: "config-id",
  complexityThreshold: 15,
  complexityMaxCcnThreshold: 30,
  spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
  criterionWeights: {},
  criterionRequirementLevels: {},
  categoryWeights: {},
};

describe("KPI targets and SLA terms in the scoring config", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads them from the backend on top of the proposed defaults", async () => {
    getAdminScoring.mockResolvedValue({
      ...response,
      kpiTargets: { "release-frequency": { min: 6 } },
      slaTerms: { bug: { respondDays: 3, fixDays: 20 } },
    });

    const { config } = await getActiveScoringConfig();

    expect(config.kpiTargets).toEqual({ ...DEFAULT_KPI_TARGETS, "release-frequency": { min: 6 } });
    expect(config.slaTerms.bug).toEqual({ respondDays: 3, fixDays: 20 });
    expect(config.slaTerms.question).toEqual(DEFAULT_SLA_TERMS.question);
  });

  it("uses the defaults when the backend has none or cannot be reached", async () => {
    getAdminScoring.mockResolvedValueOnce(response);
    expect((await getActiveScoringConfig()).config.slaTerms).toEqual(DEFAULT_SLA_TERMS);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getAdminScoring.mockRejectedValueOnce(new Error("offline"));
    expect((await getActiveScoringConfig()).config.kpiTargets).toEqual(DEFAULT_KPI_TARGETS);
  });
});
