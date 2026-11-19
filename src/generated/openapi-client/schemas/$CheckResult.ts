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
        reusedFrom: {
            description: `Set when a scan of an unchanged commit copied this result from the analysis that measured it`,
            properties: {
                analysisId: {
                    type: 'string',
                    isRequired: true,
                    isNullable: true,
                },
                checkedAt: {
                    type: 'string',
                    isRequired: true,
                    format: 'date-time',
                },
                commit: {
                    type: 'string',
                    isRequired: true,
                },
            },
        },
    },
} as const;
