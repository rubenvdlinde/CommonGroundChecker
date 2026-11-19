/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserConfirmationInput = {
    properties: {
        organisation: {
            type: 'string',
            description: `The organisation as named under usedBy in publiccode.yml; matched case-insensitively and trimmed`,
            isRequired: true,
        },
        confirmedOn: {
            type: 'string',
            isRequired: true,
            format: 'date',
        },
        source: {
            type: 'string',
            description: `Link to the written confirmation or the register entry`,
            isRequired: true,
            format: 'uri',
        },
        method: {
            type: 'Enum',
            isRequired: true,
        },
    },
} as const;
