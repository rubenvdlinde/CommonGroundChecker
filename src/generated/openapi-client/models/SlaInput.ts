/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SlaInput = {
    /**
     * Who agreed the SLA, for example VNG
     */
    party: string;
    maintainer: string;
    startsOn: string;
    /**
     * Last day the SLA applies
     */
    until: string;
    link?: string;
};

