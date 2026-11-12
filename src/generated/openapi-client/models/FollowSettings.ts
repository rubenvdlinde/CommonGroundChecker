/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FollowSettings = {
    id: string;
    /**
     * Whether the repository is rescanned on a schedule
     */
    followed: boolean;
    /**
     * Hours between scheduled checks: 24 (daily), 168 (weekly) or 720 (monthly)
     */
    checkIntervalHours: number;
    /**
     * When the latest analysis was stored
     */
    lastCheckedAt: string;
    /**
     * When the repository is next due for a scheduled check
     */
    nextCheckAt: string;
};

