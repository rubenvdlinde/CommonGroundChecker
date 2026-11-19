/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AspectRatings } from './AspectRatings';
import type { CategoryRatings } from './CategoryRatings';
import type { CheckResult } from './CheckResult';
import type { Endorsement } from './Endorsement';
import type { IssueCounts } from './IssueCounts';
import type { Rating } from './Rating';
export type RepoAnalysisOutput = {
    id: string;
    repoId: string;
    scoringConfigId?: string | null;
    checkedAt: string;
    version?: string | null;
    declaredUsers?: Array<string>;
    /**
     * Organisations under usedBy at this analysis, or null when it did not record them
     */
    declaredUserCount?: number;
    /**
     * Declared organisations with a confirmation at the time of this analysis
     */
    confirmedUserCount?: number;
    score: number;
    rating?: Rating;
    categoryRatings?: CategoryRatings;
    aspectRatings?: AspectRatings;
    endorsement?: Endorsement;
    issueCounts?: IssueCounts;
    results: Array<CheckResult>;
    createdAt: string;
};

