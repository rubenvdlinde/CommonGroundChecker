/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CheckRequest = {
    properties: {
        repoUrl: {
            type: 'string',
            isRequired: true,
        },
        helmChartLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        documentationLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        dockerLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        apiSpecificationLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        isRegister: {
            type: 'boolean',
        },
        ref: {
            type: 'string',
            description: `The branch or tag to scan. Empty scans the released version: the tag of the publiccode.yml softwareVersion, else the newest stable release or semver tag, else the default branch with a warning. "default-branch" scans the default branch, "latest-release" the newest stable release`,
        },
    },
} as const;
