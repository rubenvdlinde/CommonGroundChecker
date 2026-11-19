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
     * The branch or tag to scan. Empty scans the released version: the tag of the publiccode.yml softwareVersion, else the newest stable release or semver tag, else the default branch with a warning. "default-branch" scans the default branch, "latest-release" the newest stable release
     */
    ref?: string;
};

