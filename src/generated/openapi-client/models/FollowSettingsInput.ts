/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FollowSettingsInput = {
    followed: boolean;
    /**
     * 24 (daily), 168 (weekly) or 720 (monthly). Defaults to the stored interval, or 168 when following for the first time
     */
    checkIntervalHours?: number;
};

