/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AspectRatings } from './AspectRatings';
import type { CategoryRatings } from './CategoryRatings';
import type { CheckResult } from './CheckResult';
import type { Endorsement } from './Endorsement';
import type { Fingerprint } from './Fingerprint';
import type { Rating } from './Rating';
import type { RepoMeta } from './RepoMeta';
import type { ScanMode } from './ScanMode';
export type CheckReport = {
    repoUrl: string;
    owner: string;
    repo: string;
    checkedAt: string;
    scoringConfigId?: string | null;
    /**
     * The checklist version the analysis was measured against, for example 2026.1
     */
    checklistVersion?: string;
    score: number;
    rating?: Rating;
    categoryRatings?: CategoryRatings;
    aspectRatings?: AspectRatings;
    endorsement?: Endorsement;
    results: Array<CheckResult>;
    /**
     * The branch or tag name that was scanned
     */
    scannedRef: string;
    /**
     * Why the scanned ref was chosen: declared-version (the tag of the publiccode.yml softwareVersion), release (the newest stable release), tag (the newest stable semver tag), branch (named in the request), default-branch (asked for), or default-branch-fallback (no release found)
     */
    scannedRefKind: string;
    /**
     * The commit SHA that was scanned
     */
    scannedCommit: string | null;
    /**
     * Set when no released version was found and the default branch was scanned instead
     */
    scanRefWarning?: string;
    scanMode?: ScanMode;
    /**
     * How long the scan took, in seconds
     */
    scanDurationSeconds?: number | null;
    toolFingerprint?: Fingerprint;
    inputsFingerprint?: Fingerprint;
    /**
     * Why the scan was full or partial, for example "the code changed"
     */
    scanModeReason?: string;
    repoMeta: RepoMeta;
};

