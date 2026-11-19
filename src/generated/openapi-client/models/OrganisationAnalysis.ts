/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckResult } from './CheckResult';
export type OrganisationAnalysis = {
    id: string;
    checkedAt: string;
    version: string;
    scannedRef: string;
    scannedRefKind: string;
    declaredUserCount: number;
    score: number;
    results: Array<CheckResult>;
};

