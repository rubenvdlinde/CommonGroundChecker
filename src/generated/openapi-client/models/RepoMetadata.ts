/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RepoMetadata = {
    repoUrl: string;
    description?: string;
    language?: string;
    stars?: number;
    forks?: number;
    defaultBranch?: string;
    topics?: Array<string>;
    license?: string;
    version?: string;
    versionEvidenceSource?: string;
    versionEvidenceDetail?: string;
    helmChartLocations?: Array<string>;
    dockerLocations?: Array<string>;
    apiSpecificationLocations?: Array<string>;
    documentationLocations?: Array<string>;
    /**
     * Software name from publiccode.yml (name)
     */
    displayName?: string;
    /**
     * Short description from publiccode.yml: the Dutch one if present, else English, else the first available language
     */
    shortDescription?: string;
    /**
     * Absolute http(s) URL of the logo from publiccode.yml (logo), resolved to the git host's raw URL when it is a repository path
     */
    logoUrl?: string;
    /**
     * Development status from publiccode.yml (developmentStatus)
     */
    developmentStatus?: string;
    /**
     * Maintenance type from publiccode.yml (maintenance.type)
     */
    maintenanceType?: string;
    /**
     * Maintainers from publiccode.yml: the names in maintenance.contacts, else the organisation names (maintenance.contractors, organisation)
     */
    maintainers?: Array<string>;
};

