/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $FollowSettings = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        followed: {
            type: 'boolean',
            description: `Whether the repository is rescanned on a schedule`,
            isRequired: true,
        },
        checkIntervalHours: {
            type: 'number',
            description: `Hours between scheduled checks: 24 (daily), 168 (weekly) or 720 (monthly)`,
            isRequired: true,
        },
        scanRef: {
            type: 'string',
            description: `The branch or tag scheduled scans use: null for the released version (the tag of the publiccode.yml softwareVersion, else the latest release), "default-branch", "latest-release", or a branch or tag name`,
            isRequired: true,
            isNullable: true,
        },
        lastCheckedAt: {
            type: 'string',
            description: `When the latest analysis was stored`,
            isRequired: true,
            format: 'date-time',
        },
        nextCheckAt: {
            type: 'string',
            description: `When the repository is next due for a scheduled check`,
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
