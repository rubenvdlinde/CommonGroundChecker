/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CheckResult = {
    id: string;
    title: string;
    description: string;
    requirementLevel?: CheckResult.requirementLevel;
    status: CheckResult.status;
    message: string;
    evidence?: Array<string>;
    referenceUrl?: string;
    confidence?: CheckResult.confidence;
    /**
     * 1 to 5 stars; from the criterion's own scale, or derived from its status
     */
    starRating?: number;
};
export namespace CheckResult {
    export enum requirementLevel {
        MANDATORY = 'mandatory',
        RECOMMENDED = 'recommended',
        INFORMATIVE = 'informative',
    }
    export enum status {
        PASS = 'pass',
        FAIL = 'fail',
        WARN = 'warn',
        INFO = 'info',
    }
    export enum confidence {
        HIGH = 'high',
        MEDIUM = 'medium',
        LOW = 'low',
    }
}

