/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganisationDetail = {
    properties: {
        organisation: {
            properties: {
                name: {
                    type: 'string',
                    isRequired: true,
                },
                slug: {
                    type: 'string',
                    isRequired: true,
                },
                spellings: {
                    type: 'array',
                    contains: {
                        type: 'string',
                    },
                    isRequired: true,
                },
                componentCount: {
                    type: 'number',
                    isRequired: true,
                },
            },
            isRequired: true,
        },
        components: {
            type: 'array',
            contains: {
                type: 'OrganisationComponent',
            },
            isRequired: true,
        },
    },
} as const;
