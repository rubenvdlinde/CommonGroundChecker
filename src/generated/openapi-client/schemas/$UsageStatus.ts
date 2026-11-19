/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UsageStatus = {
    properties: {
        declaredUsers: {
            type: 'any[]',
            description: `Organisations under usedBy in the latest analysis, or null when it did not record them`,
            isRequired: true,
        },
        declaredUserCount: {
            type: 'number',
            isRequired: true,
        },
        confirmedUserCount: {
            type: 'number',
            isRequired: true,
        },
        confirmations: {
            type: 'array',
            contains: {
                type: 'UserConfirmation',
            },
            isRequired: true,
        },
        slas: {
            type: 'array',
            contains: {
                type: 'Sla',
            },
            isRequired: true,
        },
    },
} as const;
