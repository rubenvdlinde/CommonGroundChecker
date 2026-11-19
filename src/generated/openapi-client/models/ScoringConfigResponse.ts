/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScoringConfigResponse = {
    ok?: boolean;
    scoringConfigId: string | null;
    complexityThreshold: number;
    complexityMaxCcnThreshold: number;
    spectralRulesetSource: string;
    criterionWeights: Record<string, number>;
    criterionRequirementLevels: Record<string, 'mandatory' | 'recommended'>;
    categoryWeights: Record<string, number>;
    defaultCriterionWeights: Record<string, number>;
    defaultCriterionRequirementLevels: Record<string, 'mandatory' | 'recommended' | 'informative'>;
    defaultCategoryWeights: Record<string, number>;
    defaultComplexityThreshold: number;
    defaultComplexityMaxCcnThreshold: number;
    defaultSpectralRulesetSource: string;
    /**
     * Days to recover a drop; proposals
     */
    fixTerms?: Record<string, any>;
    /**
     * Proposed target values per CHAOSS metric id: at least min, at most max
     */
    kpiTargets?: Record<string, {
        min?: number;
        max?: number;
    }>;
    /**
     * Proposed SLA response and fix terms per issue category, in working days
     */
    slaTerms?: Record<string, Record<string, any>>;
};

