import type { CheckResult, ReusedFrom } from "./types";

/** The earliest analysis a run's reused results come from, or null when none was reused. */
export function codeUnchangedSince(results: Pick<CheckResult, "reusedFrom">[]): ReusedFrom | null {
  let earliest: ReusedFrom | null = null;
  for (const { reusedFrom } of results) {
    if (reusedFrom && (!earliest || reusedFrom.checkedAt < earliest.checkedAt)) earliest = reusedFrom;
  }
  return earliest;
}

/** "19 November 2026" */
export function formatScanDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** The first 7 characters of a commit SHA. */
export function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}

/** "Code unchanged since 12 November 2026 (commit abc1234): code checks reused, outside-world checks run again" */
export function codeUnchangedLine(from: ReusedFrom): string {
  return `Code unchanged since ${formatScanDate(from.checkedAt)} (commit ${shortCommit(from.commit)}): code checks reused, outside-world checks run again`;
}

/** "Reused from the scan of 12 November 2026 (commit abc1234). The code did not change since." */
export function reusedNote(from: ReusedFrom): string {
  return `Reused from the scan of ${formatScanDate(from.checkedAt)} (commit ${shortCommit(from.commit)}). The code did not change since.`;
}

/** A stored `reusedFrom`, or undefined when it is missing or malformed. */
export function readReusedFrom(value: unknown): ReusedFrom | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { analysisId, checkedAt, commit } = value as Record<string, unknown>;
  if (typeof checkedAt !== "string" || typeof commit !== "string") return undefined;
  return { analysisId: typeof analysisId === "string" ? analysisId : null, checkedAt, commit };
}

/** "Scan took 4.2 s" or "Scan took 3 min 2 s" */
export function scanDurationText(seconds: number): string {
  if (seconds < 60) return `Scan took ${Math.round(seconds * 10) / 10} s`;
  const whole = Math.round(seconds);
  return `Scan took ${Math.floor(whole / 60)} min ${whole % 60} s`;
}
