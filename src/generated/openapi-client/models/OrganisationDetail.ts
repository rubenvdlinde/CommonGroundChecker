/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganisationComponent } from './OrganisationComponent';
export type OrganisationDetail = {
    organisation: {
        name: string;
        slug: string;
        /**
         * Every spelling seen under usedBy, most common first
         */
        spellings: Array<string>;
        componentCount: number;
    };
    components: Array<OrganisationComponent>;
};

