/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganisationAnalysis } from './OrganisationAnalysis';
import type { Sla } from './Sla';
export type OrganisationComponent = {
    repoId: string;
    owner: string;
    name: string;
    repoUrl: string;
    /**
     * When an admin retired the repository; null when it is not retired
     */
    retiredAt?: string | null;
    /**
     * Why an admin retired the repository
     */
    retiredReason?: string | null;
    openDropCount?: number;
    overdueDropCount?: number;
    /**
     * The earliest fix-by date of the open drops
     */
    nextFixBy?: string | null;
    slas: Array<Sla>;
    latestAnalysis: (OrganisationAnalysis | null);
};

