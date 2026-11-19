/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserConfirmation = {
    id: string;
    organisation: string;
    confirmedOn: string;
    source: string;
    method: string;
    /**
     * Whether the latest analysis declares this organisation under usedBy; only declared organisations count as confirmed users
     */
    declared: boolean;
};

