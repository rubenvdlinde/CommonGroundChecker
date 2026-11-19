/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepoMeta = {
    properties: {
        description: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        language: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        stars: {
            type: 'number',
            isRequired: true,
        },
        forks: {
            type: 'number',
            isRequired: true,
        },
        defaultBranch: {
            type: 'string',
            isRequired: true,
        },
        topics: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        license: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        version: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        versionEvidence: {
            properties: {
                source: {
                    type: 'Enum',
                    isRequired: true,
                },
                detail: {
                    type: 'string',
                    isRequired: true,
                },
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
    },
} as const;
