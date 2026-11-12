/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepoAnalysisInput = {
    properties: {
        scoringConfigId: {
            type: 'string',
            isNullable: true,
        },
        checkedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        version: {
            type: 'string',
            isNullable: true,
        },
        score: {
            type: 'number',
            isRequired: true,
        },
        rating: {
            type: 'Rating',
        },
        categoryRatings: {
            type: 'CategoryRatings',
        },
        aspectRatings: {
            type: 'AspectRatings',
        },
        endorsement: {
            type: 'Endorsement',
        },
        issueCounts: {
            type: 'IssueCounts',
        },
        results: {
            type: 'array',
            contains: {
                type: 'CheckResult',
            },
            isRequired: true,
        },
    },
} as const;
