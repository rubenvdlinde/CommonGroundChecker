/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserConfirmation = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        organisation: {
            type: 'string',
            isRequired: true,
        },
        confirmedOn: {
            type: 'string',
            isRequired: true,
            format: 'date',
        },
        source: {
            type: 'string',
            isRequired: true,
        },
        method: {
            type: 'string',
            isRequired: true,
        },
        declared: {
            type: 'boolean',
            description: `Whether the latest analysis declares this organisation under usedBy; only declared organisations count as confirmed users`,
            isRequired: true,
        },
    },
} as const;
