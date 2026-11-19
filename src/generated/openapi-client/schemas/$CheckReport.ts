/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CheckReport = {
    properties: {
        repoUrl: {
            type: 'string',
            isRequired: true,
        },
        owner: {
            type: 'string',
            isRequired: true,
        },
        repo: {
            type: 'string',
            isRequired: true,
        },
        checkedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        scoringConfigId: {
            type: 'string',
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
        results: {
            type: 'array',
            contains: {
                type: 'CheckResult',
            },
            isRequired: true,
        },
        scannedRef: {
            type: 'string',
            description: `The branch or tag name that was scanned`,
            isRequired: true,
        },
        scannedRefKind: {
            type: 'string',
            description: `Why the scanned ref was chosen: declared-version (the tag of the publiccode.yml softwareVersion), release (the newest stable release), tag (the newest stable semver tag), branch (named in the request), default-branch (asked for), or default-branch-fallback (no release found)`,
            isRequired: true,
        },
        scannedCommit: {
            type: 'string',
            description: `The commit SHA that was scanned`,
            isRequired: true,
            isNullable: true,
        },
        scanRefWarning: {
            type: 'string',
            description: `Set when no released version was found and the default branch was scanned instead`,
        },
        repoMeta: {
            type: 'RepoMeta',
            isRequired: true,
        },
    },
} as const;
