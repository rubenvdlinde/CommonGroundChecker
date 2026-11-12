/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepoAnalysisOutput = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        repoId: {
            type: 'string',
            isRequired: true,
        },
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
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
