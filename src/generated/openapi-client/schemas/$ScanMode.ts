/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ScanMode = {
    type: 'string',
    description: `full when every check ran; partial when the commit, checklist version, tools and scan settings were unchanged, so the code checks were copied from an earlier analysis (each such result carries reusedFrom) and only the outside-world checks ran`,
    isNullable: true,
    pattern: '^(full|partial)$',
} as const;
