/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Sla } from './Sla';
import type { UserConfirmation } from './UserConfirmation';
export type UsageStatus = {
    /**
     * Organisations under usedBy in the latest analysis, or null when it did not record them
     */
    declaredUsers: any[];
    declaredUserCount: number;
    confirmedUserCount: number;
    confirmations: Array<UserConfirmation>;
    slas: Array<Sla>;
};

