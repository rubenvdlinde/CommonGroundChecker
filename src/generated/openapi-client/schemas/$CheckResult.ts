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
        rating: {
            type: 'number',
            description: `Continuous rating from 0.5 to 5.5, for a criterion measured on a continuous scale`,
            maximum: 5.5,
            minimum: 0.5,
        },
        aspectRatings: {
            type: 'dictionary',
            contains: {
                type: 'Rating',
            },
        },
        mandatoryFrom: {
            type: 'string',
            description: `For a mandatory criterion in its transition period at the time of the check: the date it becomes mandatory. Until then a fail is a warning.`,
            format: 'date',
        },
    },
} as const;
