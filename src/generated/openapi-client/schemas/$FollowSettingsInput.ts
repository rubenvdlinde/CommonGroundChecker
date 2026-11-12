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
    },
} as const;
