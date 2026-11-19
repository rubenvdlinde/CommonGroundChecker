/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Sla = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        party: {
            type: 'string',
            isRequired: true,
        },
        maintainer: {
            type: 'string',
            isRequired: true,
        },
        startsOn: {
            type: 'string',
            isRequired: true,
            format: 'date',
        },
        until: {
            type: 'string',
            isRequired: true,
            format: 'date',
        },
        link: {
            type: 'string',
            isRequired: true,
        },
    },
} as const;
