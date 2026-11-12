import { CheckCircle, XCircle } from "lucide-react";

export interface RunStatusSummary {
  passed: boolean;
  /** Entries in the run's errors block; for a run without stored counts, its endorsement reasons */
  failures: number;
  /** Entries in the run's warnings block; null for a run without stored counts */
  warnings: number | null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Whether a stored run passed, with its failure and warning counts. Null for
 * an older run without a stored endorsement. A run with an endorsement but no
 * stored counts takes its failures from the endorsement reasons.
 */
export function runStatus(latestAnalysis: unknown): RunStatusSummary | null {
  const analysis = asObject(latestAnalysis);
  const endorsement = asObject(analysis?.endorsement);
  if (!endorsement || typeof endorsement.passed !== "boolean" || !Array.isArray(endorsement.reasons)) return null;

  const counts = asObject(analysis?.issueCounts);
  if (counts && isCount(counts.errors) && isCount(counts.warnings)) {
    return { passed: endorsement.passed, failures: counts.errors, warnings: counts.warnings };
  }
  return {
    passed: endorsement.passed,
    failures: endorsement.passed ? 0 : endorsement.reasons.length,
    warnings: null,
  };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** A "Passed" or "Failed" chip, followed by the failures (when failed) and the warnings, when there are any. */
export default function RunStatus({ status }: { status: RunStatusSummary }) {
  return (
    <>
      {status.passed ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border border-green-300 text-green-700 bg-green-50">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Passed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border border-red-300 text-red-700 bg-red-50">
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Failed
        </span>
      )}
      {!status.passed && status.failures > 0 && (
        <span className="text-xs font-semibold text-red-700">{plural(status.failures, "failure", "failures")}</span>
      )}
      {status.warnings !== null && status.warnings > 0 && (
        <span className="text-xs font-semibold text-yellow-700">{plural(status.warnings, "warning", "warnings")}</span>
      )}
    </>
  );
}
