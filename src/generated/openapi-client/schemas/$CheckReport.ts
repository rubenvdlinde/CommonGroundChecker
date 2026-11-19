/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CheckReport = {
    properties: {
        repoUrl: {
            type: 'string',
            isRequired: true,
        },
        owner: {
            type: 'string',
            isRequired: true,
        },
        repo: {
            type: 'string',
            isRequired: true,
        },
        checkedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        scoringConfigId: {
            type: 'string',
            isNullable: true,
        },
        checklistVersion: {
            type: 'string',
            description: `The checklist version the analysis was measured against, for example 2026.1`,
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
        results: {
            type: 'array',
            contains: {
                type: 'CheckResult',
            },
            isRequired: true,
        },
        repoMeta: {
            type: 'RepoMeta',
            isRequired: true,
        },
    },
} as const;
