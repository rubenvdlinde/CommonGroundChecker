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
     * The branch or tag name that was scanned, for example development or v1.2.0
     */
    scannedRef?: string | null;
    /**
     * Why the scanned ref was chosen: declared-version (the tag of the publiccode.yml softwareVersion), release (the newest stable release), tag (the newest stable semver tag), branch (named in the request), default-branch (asked for), or default-branch-fallback (no release found)
     */
    scannedRefKind?: string | null;
    /**
     * The commit SHA that was scanned
     */
    scannedCommit?: string | null;
    score: number;
    rating?: Rating;
    categoryRatings?: CategoryRatings;
    aspectRatings?: AspectRatings;
    endorsement?: Endorsement;
    issueCounts?: IssueCounts;
    results: Array<CheckResult>;
    createdAt: string;
};

