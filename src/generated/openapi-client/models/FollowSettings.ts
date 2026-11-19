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
     * The branch or tag scheduled scans use: null for the released version (the tag of the publiccode.yml softwareVersion, else the latest release), "default-branch", "latest-release", or a branch or tag name
     */
    scanRef: string | null;
    /**
     * When the latest analysis was stored
     */
    lastCheckedAt: string;
    /**
     * When the repository is next due for a scheduled check
     */
    nextCheckAt: string;
};

