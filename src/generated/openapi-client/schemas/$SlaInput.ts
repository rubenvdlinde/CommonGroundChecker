/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $SlaInput = {
    properties: {
        party: {
            type: 'string',
            description: `Who agreed the SLA, for example VNG`,
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
            description: `Last day the SLA applies`,
            isRequired: true,
            format: 'date',
        },
        link: {
            type: 'string',
            format: 'uri',
        },
    },
} as const;
