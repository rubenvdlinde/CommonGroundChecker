/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepoAnalysisOutput = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        repoId: {
            type: 'string',
            isRequired: true,
        },
        scoringConfigId: {
            type: 'string',
            isNullable: true,
        },
        checkedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        version: {
            type: 'string',
            isNullable: true,
        },
        declaredUsers: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        declaredUserCount: {
            type: 'number',
            description: `Organisations under usedBy at this analysis, or null when it did not record them`,
        },
        scannedRef: {
            type: 'string',
            description: `The branch or tag name that was scanned, for example development or v1.2.0`,
            isNullable: true,
        },
        scannedRefKind: {
            type: 'string',
            description: `Why the scanned ref was chosen: declared-version (the tag of the publiccode.yml softwareVersion), release (the newest stable release), tag (the newest stable semver tag), branch (named in the request), default-branch (asked for), or default-branch-fallback (no release found)`,
            isNullable: true,
        },
        scannedCommit: {
            type: 'string',
            description: `The commit SHA that was scanned`,
            isNullable: true,
        },
        score: {
            type: 'number',
            isRequired: true,
        },
        rating: {
            type: 'Rating',
        },
        categoryRatings: {
            type: 'CategoryRatings',
        },
        aspectRatings: {
            type: 'AspectRatings',
        },
        endorsement: {
            type: 'Endorsement',
        },
        checklistVersion: {
            type: 'ChecklistVersion',
        },
        issueCounts: {
            type: 'IssueCounts',
        },
        results: {
            type: 'array',
            contains: {
                type: 'CheckResult',
            },
            isRequired: true,
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
