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
export type RepoAnalysisInput = {
    scoringConfigId?: string | null;
    checkedAt: string;
    version?: string | null;
    score: number;
    rating?: Rating;
    categoryRatings?: CategoryRatings;
    aspectRatings?: AspectRatings;
    endorsement?: Endorsement;
    issueCounts?: IssueCounts;
    results: Array<CheckResult>;
};

