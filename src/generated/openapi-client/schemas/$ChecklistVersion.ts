/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ChecklistVersion = {
    type: 'string',
    description: `The checklist version the analysis was measured against, for example 2026.1; null for older analyses`,
    isNullable: true,
    pattern: '^[0-9A-Za-z][0-9A-Za-z.\\-]{0,31}$',
} as const;
