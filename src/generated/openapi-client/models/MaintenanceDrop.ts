/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A criterion, rating or verdict that got worse since the previous analysis of the same scanned ref kind
 */
export type MaintenanceDrop = {
    id: string;
    repoId: string;
    analysisId: string;
    previousAnalysisId: string;
    scannedRefKind: string | null;
    kind: 'criterion' | 'rating' | 'verdict';
    /**
     * The criterion id, overall or a category name, or suitable
     */
    subject: string;
    label: string;
    from: string;
    to: string;
    detectedAt: string;
    fixTermDays: number;
    fixBy: string;
    resolvedAt: string | null;
    resolvedAnalysisId: string | null;
    /**
     * Open past its fix-by date
     */
    overdue: boolean;
};

