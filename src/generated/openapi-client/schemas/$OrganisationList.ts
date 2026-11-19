/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganisationList = {
    properties: {
        organisations: {
            type: 'array',
            contains: {
                type: 'OrganisationSummary',
            },
            isRequired: true,
        },
        nearDuplicates: {
            type: 'array',
            contains: {
                type: 'NearDuplicate',
            },
            isRequired: true,
        },
    },
} as const;
