/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganisationComponent = {
    properties: {
        repoId: {
            type: 'string',
            isRequired: true,
        },
        owner: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        repoUrl: {
            type: 'string',
            isRequired: true,
        },
        slas: {
            type: 'array',
            contains: {
                type: 'Sla',
            },
            isRequired: true,
        },
        latestAnalysis: {
            type: 'one-of',
            contains: [{
                type: 'OrganisationAnalysis',
            }, {
                type: 'null',
            }],
            isRequired: true,
        },
    },
} as const;
