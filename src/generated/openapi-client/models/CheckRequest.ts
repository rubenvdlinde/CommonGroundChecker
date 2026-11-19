/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CheckRequest = {
    repoUrl: string;
    helmChartLocations?: Array<string>;
    documentationLocations?: Array<string>;
    dockerLocations?: Array<string>;
    apiSpecificationLocations?: Array<string>;
    isRegister?: boolean;
    /**
     * The repository's own labels for the SLA times, on top of GitHub's default labels: label name to blocking-bug, bug, question, documentation, feature-request, no-fix-term or ignore
     */
    slaLabels?: Record<string, string> | null;
};

