/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RetireState = {
    id: string;
    /**
     * When an admin retired the repository; null when it is not retired
     */
    retiredAt: string | null;
    /**
     * Why an admin retired the repository
     */
    retiredReason: string | null;
    nextCheckAt: string;
};

