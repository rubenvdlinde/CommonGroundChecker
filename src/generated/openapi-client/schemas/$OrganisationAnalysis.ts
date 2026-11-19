/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganisationAnalysis = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        checkedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        version: {
            type: 'string',
            isRequired: true,
        },
        scannedRef: {
            type: 'string',
            isRequired: true,
        },
        scannedRefKind: {
            type: 'string',
            isRequired: true,
        },
        declaredUserCount: {
            type: 'number',
            isRequired: true,
        },
        score: {
            type: 'number',
            isRequired: true,
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
