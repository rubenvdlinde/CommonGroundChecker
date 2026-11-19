/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $NearDuplicate = {
    description: `Organisations listed separately whose names differ only in accents, punctuation or a prefix such as Gemeente`,
    properties: {
        names: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        slugs: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
    },
} as const;
