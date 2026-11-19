import { createHash } from "node:crypto";
import { criterionFreshness } from "./checkers/config";
import type { CheckResult, ReusedFrom, ScanMode } from "./types";

/** A full scan at least this often, also when nothing changed. */
export const DEFAULT_FULL_SCAN_INTERVAL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The previous completed analysis of the same repository, as the store returns it. */
export interface PreviousAnalysis {
  id?: string | null;
  checkedAt: string;
  scannedCommit?: string | null;
  checklistVersion?: string | null;
  toolFingerprint?: string | null;
  inputsFingerprint?: string | null;
  results: CheckResult[];
}

export interface ScanModeInput {
  previous: PreviousAnalysis | null;
  commit: string | null;
  checklistVersion: string;
  toolFingerprint: string;
  inputsFingerprint: string;
  now: Date;
  fullScanIntervalDays: number;
  /** A full scan was asked for */
  full?: boolean;
}

export interface ScanModeDecision {
  mode: ScanMode;
  reason: string;
  /** For a partial scan: the per-commit results to copy, by criterion id */
  reused: Map<string, CheckResult>;
}

/** FULL_SCAN_INTERVAL_DAYS as a whole number of 1 or more, else the default of 7. */
export function readFullScanIntervalDays(env: NodeJS.ProcessEnv = process.env): number {
  const days = Number(env.FULL_SCAN_INTERVAL_DAYS);
  return Number.isInteger(days) && days >= 1 ? days : DEFAULT_FULL_SCAN_INTERVAL_DAYS;
}

/** "sha256:" and the first 32 hex characters of the sha256 of `value`. */
export function shortHash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

export interface ScanInputs {
  helmChartLocations?: string[];
  dockerLocations?: string[];
  documentationLocations?: string[];
  apiSpecificationLocations?: string[];
  isRegister?: boolean;
  complexityThreshold: number;
  complexityMaxCcnThreshold: number;
}

/** Hash of the scan settings that per-commit checks read, so a changed hint or threshold means a full scan. */
export function inputsFingerprint(inputs: ScanInputs): string {
  const sorted = (list: string[] | undefined) => [...(list ?? [])].sort();
  return shortHash(
    JSON.stringify({
      helm: sorted(inputs.helmChartLocations),
      docker: sorted(inputs.dockerLocations),
      docs: sorted(inputs.documentationLocations),
      api: sorted(inputs.apiSpecificationLocations),
      register: inputs.isRegister === true,
      complexity: [inputs.complexityThreshold, inputs.complexityMaxCcnThreshold],
    })
  );
}

/** The analysis that measured a result: its own `reusedFrom`, else the analysis it is stored in. */
function measuredIn(result: CheckResult, previous: PreviousAnalysis, commit: string): ReusedFrom {
  return result.reusedFrom ?? { analysisId: previous.id ?? null, checkedAt: previous.checkedAt, commit };
}

/**
 * When the per-commit results of `previous` were last measured: the oldest
 * `reusedFrom` among them, or the previous analysis itself when it was full.
 */
export function lastMeasuredAt(previous: PreviousAnalysis): string {
  let oldest = previous.checkedAt;
  for (const result of previous.results) {
    const at = result.reusedFrom?.checkedAt;
    if (at && criterionFreshness(result.id) === "per-commit" && at < oldest) oldest = at;
  }
  return oldest;
}

/** A per-commit result copied for a new analysis, without what the new analysis sets itself. */
export function reuseResult(result: CheckResult, from: ReusedFrom): CheckResult {
  const copy: CheckResult = { ...result, reusedFrom: from };
  delete copy.mandatoryFrom;
  delete copy.requirementLevel;
  return copy;
}

function full(reason: string): ScanModeDecision {
  return { mode: "full", reason, reused: new Map() };
}

/**
 * Full or partial. Partial only when the previous analysis scanned the same
 * commit against the same checklist version, with the same checker and tools
 * and the same scan settings, and its code checks were measured less than
 * `fullScanIntervalDays` ago. A partial scan copies every per-commit result
 * of the previous analysis and measures the per-run criteria again.
 */
export function decideScanMode(input: ScanModeInput): ScanModeDecision {
  const { previous, commit } = input;
  if (input.full) return full("a full scan was asked for");
  if (!previous) return full("there is no previous analysis");
  if (!commit) return full("the scanned commit is not known");
  if (previous.scannedCommit !== commit) return full("the code changed");
  if (previous.checklistVersion !== input.checklistVersion) return full("the checklist version changed");
  if (previous.toolFingerprint !== input.toolFingerprint) return full("the checker or its tools changed");
  if (previous.inputsFingerprint !== input.inputsFingerprint) return full("the scan settings changed");

  const measuredAt = Date.parse(lastMeasuredAt(previous));
  if (!Number.isFinite(measuredAt) || input.now.getTime() - measuredAt >= input.fullScanIntervalDays * DAY_MS) {
    return full(`the code checks are ${input.fullScanIntervalDays} days or more old`);
  }

  const reused = new Map<string, CheckResult>();
  for (const result of previous.results) {
    if (criterionFreshness(result.id) !== "per-commit") continue;
    reused.set(result.id, reuseResult(result, measuredIn(result, previous, commit)));
  }
  if (reused.size === 0) return full("the previous analysis has no code checks to reuse");
  return { mode: "partial", reason: "the code did not change", reused };
}

/** Reads a stored analysis as a previous analysis, or null when it lacks what a reuse needs. */
export function toPreviousAnalysis(value: unknown): PreviousAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const checkedAt =
    typeof raw.checkedAt === "string" ? raw.checkedAt : raw.checkedAt instanceof Date ? raw.checkedAt.toISOString() : null;
  if (!checkedAt || !Array.isArray(raw.results)) return null;
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : null);
  return {
    id: text("id"),
    checkedAt,
    scannedCommit: text("scannedCommit"),
    checklistVersion: text("checklistVersion"),
    toolFingerprint: text("toolFingerprint"),
    inputsFingerprint: text("inputsFingerprint"),
    results: raw.results as CheckResult[],
  };
}
