import { getRepoHistory } from "@/lib/apiClient";
import { toPreviousAnalysis, type PreviousAnalysis } from "@/lib/incremental";
import { resolveRepositoryContext } from "@/lib/providers";
import type { CheckReport } from "@/lib/types";

/**
 * The latest stored analysis of a repository, for reusing its code checks.
 * Null when the repository has none or the store cannot be reached: the scan is then full.
 */
export async function fetchPreviousAnalysis(repoUrl: string): Promise<PreviousAnalysis | null> {
  const context = resolveRepositoryContext(repoUrl);
  if (!context) return null;
  try {
    const history = await getRepoHistory(context.owner, context.repo, 1);
    return toPreviousAnalysis(history.analyses?.[0]);
  } catch {
    return null;
  }
}

/** The fields an analysis stores about how it was scanned. */
export function scanFieldsOf(report: CheckReport) {
  return {
    scanMode: report.scanMode ?? null,
    scanDurationSeconds: report.scanDurationSeconds ?? null,
    toolFingerprint: report.toolFingerprint ?? null,
    inputsFingerprint: report.inputsFingerprint ?? null,
  };
}
