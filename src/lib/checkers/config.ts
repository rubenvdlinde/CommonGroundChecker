import type { CheckStatus, RequirementLevel } from "../types";
import { getAdminScoring } from "@/lib/apiClient";
import type { ScoringConfigResponse } from "@/generated/openapi-client";
import { CATEGORY_WEIGHTS } from "../criteria";
import type { CriteriaCategory, CategoryWeights } from "../criteria";

export interface CriterionConfig {
  weight: number;
  requirementLevel: RequirementLevel;
}

interface ScoringConfigOverrides {
  criterionWeights?: Record<string, number>;
  criterionRequirementLevels?: Record<string, RequirementLevel>;
  categoryWeights?: Record<string, number>;
  complexityThreshold?: number;
  complexityMaxCcnThreshold?: number;
  spectralRulesetSource?: string;
}

export interface ScoringConfig {
  criterionConfigByCheckId: Record<string, CriterionConfig>;
  categoryWeights: CategoryWeights;
  statusScoreByStatus: Record<CheckStatus, number>;
  complexityThreshold: number;
  complexityMaxCcnThreshold: number;
  spectralRulesetSource: string;
}

export interface ActiveScoringConfig {
  id: string | null;
  config: ScoringConfig;
}

export const DEFAULT_STATUS_SCORE_BY_STATUS: Record<CheckStatus, number> = {
  pass: 1,
  warn: 0.5,
  info: 0.5,
  fail: 0,
};

export const DEFAULT_COMPLEXITY_THRESHOLD = 15;
export const DEFAULT_COMPLEXITY_MAX_CCN_THRESHOLD = 30;
export const DEFAULT_SPECTRAL_RULESET_SOURCE =
  "https://static.developer.overheid.nl/adr/ruleset.yaml";

export const DEFAULT_CRITERION_CONFIG_BY_CHECK_ID: Record<string, CriterionConfig> = {
  sourcecode: { weight: 1, requirementLevel: "mandatory" },
  openapi: { weight: 1, requirementLevel: "mandatory" },
  license: { weight: 1, requirementLevel: "mandatory" },
  eupllicense: { weight: 1, requirementLevel: "mandatory" },
  copyrightowner: { weight: 1, requirementLevel: "mandatory" },
  publiccode: { weight: 1, requirementLevel: "mandatory" },
  docker: { weight: 1, requirementLevel: "mandatory" },
  dockerimage: { weight: 1, requirementLevel: "mandatory" },
  helmchart: { weight: 1, requirementLevel: "mandatory" },
  documentation: { weight: 1, requirementLevel: "mandatory" },
  changelog: { weight: 1, requirementLevel: "recommended" },
  tests: { weight: 1, requirementLevel: "mandatory" },
  cicd: { weight: 1, requirementLevel: "mandatory" },
  complexity: { weight: 1, requirementLevel: "mandatory" },
  codemetrics: { weight: 0, requirementLevel: "informative" },
  owaspsecurecoding: { weight: 1, requirementLevel: "mandatory" },
  adrvalidator: { weight: 1, requirementLevel: "mandatory" },
  contributing: { weight: 1, requirementLevel: "mandatory" },
  codeofconduct: { weight: 1, requirementLevel: "mandatory" },
  security: { weight: 1, requirementLevel: "mandatory" },
  semver: { weight: 1, requirementLevel: "mandatory" },
  sbom: { weight: 1, requirementLevel: "mandatory" },
  coverage: { weight: 1, requirementLevel: "mandatory" },
  fivelayer: { weight: 1, requirementLevel: "mandatory" },
};

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function clampComplexityThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COMPLEXITY_THRESHOLD;
  const rounded = Math.round(value);
  return Math.max(1, Math.min(100, rounded));
}

function clampComplexityMaxCcnThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COMPLEXITY_MAX_CCN_THRESHOLD;
  const rounded = Math.round(value);
  return Math.max(1, Math.min(200, rounded));
}

function sanitizeSpectralRulesetSource(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SPECTRAL_RULESET_SOURCE;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SPECTRAL_RULESET_SOURCE;
}

function buildScoringConfig(overrides?: ScoringConfigOverrides): ScoringConfig {
  const criterionConfigByCheckId: Record<string, CriterionConfig> =
    Object.fromEntries(
      Object.entries(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID).map(([checkId, config]) => {
        const overrideWeight = overrides?.criterionWeights?.[checkId];
        const overrideLevel = overrides?.criterionRequirementLevels?.[checkId];
        const effectiveLevel: RequirementLevel =
          config.requirementLevel === "informative"
            ? "informative"
            : overrideLevel === "mandatory" || overrideLevel === "recommended"
              ? overrideLevel
              : config.requirementLevel;
        const effectiveWeight =
          effectiveLevel === "informative"
            ? 0
            : typeof overrideWeight === "number"
              ? clampWeight(overrideWeight)
              : config.weight;

        return [
          checkId,
          {
            requirementLevel: effectiveLevel,
            weight: effectiveWeight,
          },
        ];
      })
    );

  return {
    criterionConfigByCheckId,
    categoryWeights: ((): CategoryWeights => {
      if (!overrides?.categoryWeights) return CATEGORY_WEIGHTS;
      return Object.fromEntries(
        Object.entries(CATEGORY_WEIGHTS).map(([category, defaultValue]) => {
          const overrideValue = overrides.categoryWeights?.[category];
          return [
            category,
            typeof overrideValue === "number"
              ? Math.max(0, Math.min(1, Math.round(overrideValue * 100) / 100))
              : defaultValue,
          ];
        })
      ) as CategoryWeights;
    })(),
    statusScoreByStatus: { ...DEFAULT_STATUS_SCORE_BY_STATUS },
    complexityThreshold:
      typeof overrides?.complexityThreshold === "number"
        ? clampComplexityThreshold(overrides.complexityThreshold)
        : DEFAULT_COMPLEXITY_THRESHOLD,
    complexityMaxCcnThreshold:
      typeof overrides?.complexityMaxCcnThreshold === "number"
        ? clampComplexityMaxCcnThreshold(overrides.complexityMaxCcnThreshold)
        : DEFAULT_COMPLEXITY_MAX_CCN_THRESHOLD,
    spectralRulesetSource: sanitizeSpectralRulesetSource(
      overrides?.spectralRulesetSource
    ),
  };
}

function parseOverridesFromDbPayload(payload: unknown): ScoringConfigOverrides {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const candidate = payload as Record<string, unknown>;
  const criterionWeightsRaw = candidate.criterionWeights;
  const criterionRequirementLevelsRaw = candidate.criterionRequirementLevels;
  const categoryWeightsRaw = candidate.categoryWeights;
  const complexityThresholdRaw = candidate.complexityThreshold;
  const complexityMaxCcnThresholdRaw = candidate.complexityMaxCcnThreshold;
  const spectralRulesetSourceRaw = candidate.spectralRulesetSource;
  const criterionWeights: Record<string, number> = {};
  if (criterionWeightsRaw && typeof criterionWeightsRaw === "object") {
    for (const [checkId, weight] of Object.entries(
      criterionWeightsRaw as Record<string, unknown>
    )) {
      if (typeof weight === "number" && Number.isFinite(weight)) {
        criterionWeights[checkId] = weight;
      }
    }
  }

  const criterionRequirementLevels: Record<string, RequirementLevel> = {};
  if (criterionRequirementLevelsRaw && typeof criterionRequirementLevelsRaw === "object") {
    for (const [checkId, level] of Object.entries(
      criterionRequirementLevelsRaw as Record<string, unknown>
    )) {
      if (
        level === "mandatory" ||
        level === "recommended" ||
        level === "informative"
      ) {
        criterionRequirementLevels[checkId] = level;
      }
    }
  }

  const categoryWeights: Record<string, number> = {};
  if (categoryWeightsRaw && typeof categoryWeightsRaw === "object") {
    for (const [category, value] of Object.entries(
      categoryWeightsRaw as Record<string, unknown>
    )) {
      if (typeof value === "number" && Number.isFinite(value)) {
        categoryWeights[category] = Math.max(0, Math.min(1, Math.round(value * 100) / 100));
      }
    }
  }

  return {
    criterionWeights,
    criterionRequirementLevels: Object.keys(criterionRequirementLevels).length > 0 ? criterionRequirementLevels : undefined,
    categoryWeights: Object.keys(categoryWeights).length > 0 ? categoryWeights : undefined,
    complexityThreshold:
      typeof complexityThresholdRaw === "number"
        ? clampComplexityThreshold(complexityThresholdRaw)
        : undefined,
    complexityMaxCcnThreshold:
      typeof complexityMaxCcnThresholdRaw === "number"
        ? clampComplexityMaxCcnThreshold(complexityMaxCcnThresholdRaw)
        : undefined,
    spectralRulesetSource:
      typeof spectralRulesetSourceRaw === "string"
        ? sanitizeSpectralRulesetSource(spectralRulesetSourceRaw)
        : undefined,
  };
}

function parseScoringConfigResponse(response: ScoringConfigResponse) {
  return buildScoringConfig({
    criterionWeights: response.criterionWeights,
    criterionRequirementLevels: response.criterionRequirementLevels,
    categoryWeights: response.categoryWeights,
    complexityThreshold: response.complexityThreshold,
    complexityMaxCcnThreshold: response.complexityMaxCcnThreshold,
    spectralRulesetSource: response.spectralRulesetSource,
  });
}

/**
 * A scoring configuration from a payload shaped like the admin scoring response,
 * such as a saved copy of it; unknown or invalid fields fall back to the defaults.
 */
export function scoringConfigFromPayload(payload: unknown): ActiveScoringConfig {
  const id =
    payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).scoringConfigId === "string"
      ? ((payload as Record<string, unknown>).scoringConfigId as string)
      : null;
  return { id, config: buildScoringConfig(parseOverridesFromDbPayload(payload)) };
}

export async function getScoringConfig(): Promise<ScoringConfig> {
  const active = await getActiveScoringConfig();
  return active.config;
}

export async function getActiveScoringConfig(): Promise<ActiveScoringConfig> {
  try {
    const response = await getAdminScoring();
    return {
      id: response.scoringConfigId ?? null,
      config: parseScoringConfigResponse(response),
    };
  } catch (error) {
    console.error("Failed to load scoring config from API, using defaults.", error);
    return {
      id: null,
      config: buildScoringConfig(),
    };
  }
}
