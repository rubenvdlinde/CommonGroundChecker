/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepoMetadata = {
    properties: {
        repoUrl: {
            type: 'string',
            isRequired: true,
        },
        description: {
            type: 'string',
        },
        language: {
            type: 'string',
        },
        stars: {
            type: 'number',
        },
        forks: {
            type: 'number',
        },
        defaultBranch: {
            type: 'string',
        },
        topics: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        license: {
            type: 'string',
        },
        version: {
            type: 'string',
        },
        versionEvidenceSource: {
            type: 'string',
        },
        versionEvidenceDetail: {
            type: 'string',
        },
        helmChartLocations: {
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
        documentationLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        displayName: {
            type: 'string',
            description: `Software name from publiccode.yml (name)`,
        },
        shortDescription: {
            type: 'string',
            description: `Short description from publiccode.yml: the Dutch one if present, else English, else the first available language`,
        },
        logoUrl: {
            type: 'string',
            description: `Absolute http(s) URL of the logo from publiccode.yml (logo), resolved to the git host's raw URL when it is a repository path`,
        },
        developmentStatus: {
            type: 'string',
            description: `Development status from publiccode.yml (developmentStatus)`,
        },
        maintenanceType: {
            type: 'string',
            description: `Maintenance type from publiccode.yml (maintenance.type)`,
        },
        maintainers: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
    },
} as const;
