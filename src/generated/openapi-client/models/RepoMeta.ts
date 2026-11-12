/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RepoMeta = {
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
    topics: Array<string>;
    license: string | null;
    version: string | null;
    versionEvidence: {
        source: RepoMeta.source;
        detail: string;
    };
    /**
     * Software name from publiccode.yml (name)
     */
    displayName: string | null;
    /**
     * Short description from publiccode.yml: the Dutch one if present, else English, else the first available language
     */
    shortDescription: string | null;
    /**
     * Absolute http(s) URL of the logo from publiccode.yml (logo), resolved to the git host's raw URL when it is a repository path
     */
    logoUrl: string | null;
    /**
     * Development status from publiccode.yml (developmentStatus)
     */
    developmentStatus: string | null;
    /**
     * Maintenance type from publiccode.yml (maintenance.type)
     */
    maintenanceType: string | null;
    /**
     * Maintainers from publiccode.yml: the names in maintenance.contacts, else the organisation names (maintenance.contractors, organisation)
     */
    maintainers: Array<string>;
};
export namespace RepoMeta {
    export enum source {
        RELEASE = 'release',
        TAG = 'tag',
        MANIFEST = 'manifest',
        README = 'readme',
        NONE = 'none',
    }
}

