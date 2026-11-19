/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserConfirmationInput = {
    /**
     * The organisation as named under usedBy in publiccode.yml; matched case-insensitively and trimmed
     */
    organisation: string;
    confirmedOn: string;
    /**
     * Link to the written confirmation or the register entry
     */
    source: string;
    method: UserConfirmationInput.method;
};
export namespace UserConfirmationInput {
    export enum method {
        WRITTEN_CONFIRMATION = 'written-confirmation',
        REGISTER_ENTRY = 'register-entry',
    }
}

