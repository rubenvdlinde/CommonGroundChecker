/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $FollowSettingsInput = {
    properties: {
        followed: {
            type: 'boolean',
            isRequired: true,
        },
        checkIntervalHours: {
            type: 'number',
            description: `24 (daily), 168 (weekly) or 720 (monthly). Defaults to the stored interval, or 168 when following for the first time`,
        },
        scanRef: {
            type: 'string',
            description: `The branch or tag scheduled scans use: null for the released version (the tag of the publiccode.yml softwareVersion, else the latest release), "default-branch", "latest-release", or a branch or tag name`,
            isNullable: true,
        },
    },
} as const;
