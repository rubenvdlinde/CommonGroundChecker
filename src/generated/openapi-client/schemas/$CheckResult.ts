/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CheckResult = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        title: {
            type: 'string',
            isRequired: true,
        },
        description: {
            type: 'string',
            isRequired: true,
        },
        requirementLevel: {
            type: 'Enum',
        },
        status: {
            type: 'Enum',
            isRequired: true,
        },
        message: {
            type: 'string',
            isRequired: true,
        },
        evidence: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        referenceUrl: {
            type: 'string',
        },
        confidence: {
            type: 'Enum',
        },
        starRating: {
            type: 'number',
            description: `1 to 5 stars; from the criterion's own scale, or derived from its status`,
            maximum: 5,
            minimum: 1,
        },
    },
} as const;
