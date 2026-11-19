/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Rating } from './Rating';
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
    /**
     * Continuous rating from 0.5 to 5.5, for a criterion measured on a continuous scale
     */
    rating?: number;
    /**
     * Ratings from 0.5 to 5.5 the check measures for aspects of the rating model, by key
     */
    aspectRatings?: Record<string, Rating>;
    /**
     * For a mandatory criterion in its transition period at the time of the check: the date it becomes mandatory. Until then a fail is a warning.
     */
    mandatoryFrom?: string;
    /**
     * True when the criterion does not apply to this component. It then counts in no score, rating or verdict.
     */
    notApplicable?: boolean;
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

