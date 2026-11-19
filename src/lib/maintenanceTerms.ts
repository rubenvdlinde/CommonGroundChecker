/**
 * Target values for the project health KPIs and SLA terms for issues. The
 * backend's scoring configuration holds the values in effect; these are the
 * proposed defaults, used when the backend has none. Who sets the real
 * values is a governance decision that has not been taken yet.
 */

/** A target for a measured value: at least `min`, at most `max`. */
export type KpiTarget = {
  min?: number;
  max?: number;
};

/**
 * Proposed targets for the CHAOSS project health metrics, keyed by metric id.
 * Durations are in hours, release frequency in final releases per 12 months.
 */
export const DEFAULT_KPI_TARGETS: Record<string, KpiTarget> = {
  "contributor-absence-factor": { min: 2 },
  "organizational-diversity": { min: 2 },
  "change-request-closure-ratio": { min: 0.8 },
  "time-to-first-response": { max: 48 },
  "issue-response-time": { max: 120 },
  "release-frequency": { min: 4 },
};

/** The categories issues are measured in, most severe first. */
export const SLA_CATEGORIES = [
  "critical-vulnerability",
  "high-vulnerability",
  "blocking-bug",
  "bug",
  "question",
  "documentation",
  "feature-request",
  "unclassified",
] as const;

export type SlaCategory = (typeof SLA_CATEGORIES)[number];

export const SLA_CATEGORY_LABELS: Record<SlaCategory, string> = {
  "critical-vulnerability": "Critical vulnerability",
  "high-vulnerability": "High vulnerability",
  "blocking-bug": "Blocking bug",
  bug: "Other bug",
  question: "Question",
  documentation: "Documentation",
  "feature-request": "Feature request",
  unclassified: "Unclassified",
};

/**
 * Terms in working days (Monday to Friday, Europe/Amsterdam). `fixDays` is
 * "next-release" when the fix is due in the next stable release, and null
 * when the category has no fix term (development, outside maintenance).
 */
export type SlaTerm = {
  respondDays: number | null;
  fixDays: number | "next-release" | null;
};

export const DEFAULT_SLA_TERMS: Record<SlaCategory, SlaTerm> = {
  "critical-vulnerability": { respondDays: 1, fixDays: 7 },
  "high-vulnerability": { respondDays: 2, fixDays: 30 },
  "blocking-bug": { respondDays: 2, fixDays: 10 },
  bug: { respondDays: 5, fixDays: "next-release" },
  question: { respondDays: 10, fixDays: null },
  documentation: { respondDays: 10, fixDays: null },
  "feature-request": { respondDays: 10, fixDays: null },
  unclassified: { respondDays: 10, fixDays: null },
};

/** What a label stands for: an issue category, or an issue without a fix term. */
export type SlaLabelTarget = "blocking-bug" | "bug" | "question" | "documentation" | "feature-request" | "no-fix-term";

/**
 * GitHub's default labels, so a repository needs no setup. A blocking bug
 * has no default label on GitHub; these labels count only where a
 * repository uses them.
 */
export const DEFAULT_SLA_LABELS: Record<string, SlaLabelTarget> = {
  bug: "bug",
  question: "question",
  enhancement: "feature-request",
  documentation: "documentation",
  duplicate: "no-fix-term",
  invalid: "no-fix-term",
  wontfix: "no-fix-term",
  blocker: "blocking-bug",
  critical: "blocking-bug",
  "priority: critical": "blocking-bug",
};

/** GitHub issue types read as the same categories. */
export const SLA_ISSUE_TYPES: Record<string, SlaLabelTarget> = {
  bug: "bug",
  feature: "feature-request",
  task: "feature-request",
};

const LABEL_TARGETS: readonly string[] = [
  "blocking-bug",
  "bug",
  "question",
  "documentation",
  "feature-request",
  "no-fix-term",
];

/**
 * The label map in effect: the default labels with a repository's own map
 * on top. Names are lower case; "ignore" switches a default label off.
 */
export function effectiveSlaLabels(repositoryLabels?: Record<string, string> | null): Record<string, SlaLabelTarget> {
  const labels: Record<string, SlaLabelTarget> = { ...DEFAULT_SLA_LABELS };
  for (const [name, target] of Object.entries(repositoryLabels ?? {})) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (target === "ignore") delete labels[key];
    else if (LABEL_TARGETS.includes(target)) labels[key] = target as SlaLabelTarget;
  }
  return labels;
}

function isTargetValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** KPI targets from the backend on top of the defaults; invalid entries are left out. */
export function parseKpiTargets(value: unknown): Record<string, KpiTarget> {
  const result: Record<string, KpiTarget> = { ...DEFAULT_KPI_TARGETS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [metricId, target] of Object.entries(value as Record<string, unknown>)) {
    if (!target || typeof target !== "object" || Array.isArray(target)) continue;
    const { min, max } = target as Record<string, unknown>;
    const parsed: KpiTarget = {
      ...(isTargetValue(min) ? { min } : {}),
      ...(isTargetValue(max) ? { max } : {}),
    };
    if (parsed.min !== undefined || parsed.max !== undefined) result[metricId] = parsed;
  }
  return result;
}

function isWorkingDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 365;
}

/** SLA terms from the backend on top of the defaults; invalid entries are left out. */
export function parseSlaTerms(value: unknown): Record<SlaCategory, SlaTerm> {
  const result: Record<SlaCategory, SlaTerm> = { ...DEFAULT_SLA_TERMS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [category, term] of Object.entries(value as Record<string, unknown>)) {
    if (!(SLA_CATEGORIES as readonly string[]).includes(category)) continue;
    if (!term || typeof term !== "object" || Array.isArray(term)) continue;
    const { respondDays, fixDays } = term as Record<string, unknown>;
    if (respondDays !== null && !isWorkingDays(respondDays)) continue;
    if (fixDays !== null && fixDays !== "next-release" && !isWorkingDays(fixDays)) continue;
    result[category as SlaCategory] = { respondDays, fixDays };
  }
  return result;
}

/** A label map from a check request: label names to targets, as strings; anything else is null. */
export function readSlaLabelsOption(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
