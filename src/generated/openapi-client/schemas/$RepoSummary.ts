/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepoSummary = {
    properties: {
        id: {
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
        helmChartLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        dockerLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        apiSpecificationLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        documentationLocations: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        displayName: {
            type: 'string',
            description: `Software name from publiccode.yml (name)`,
            isRequired: true,
            isNullable: true,
        },
        shortDescription: {
            type: 'string',
            description: `Short description from publiccode.yml: the Dutch one if present, else English, else the first available language`,
            isRequired: true,
            isNullable: true,
        },
        logoUrl: {
            type: 'string',
            description: `Absolute http(s) URL of the logo from publiccode.yml (logo), resolved to the git host's raw URL when it is a repository path`,
            isRequired: true,
            isNullable: true,
        },
        developmentStatus: {
            type: 'string',
            description: `Development status from publiccode.yml (developmentStatus)`,
            isRequired: true,
            isNullable: true,
        },
        maintenanceType: {
            type: 'string',
            description: `Maintenance type from publiccode.yml (maintenance.type)`,
            isRequired: true,
            isNullable: true,
        },
        maintainers: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        updatedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        analysisCount: {
            type: 'number',
            isRequired: true,
        },
        latestAnalysis: {
            type: 'any',
            isRequired: true,
            isNullable: true,
        },
    },
} as const;
