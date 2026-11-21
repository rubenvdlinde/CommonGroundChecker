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
    openDropCount?: number;
    overdueDropCount?: number;
    /**
     * The earliest fix-by date of the open drops
     */
    nextFixBy?: string | null;
    slas: Array<Sla>;
    latestAnalysis: (OrganisationAnalysis | null);
};

