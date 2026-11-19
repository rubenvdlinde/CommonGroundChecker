// Shared types across checkers and UI

export type CheckStatus = "pass" | "fail" | "warn" | "info";
export type RequirementLevel = "mandatory" | "recommended" | "informative";
export type ConfidenceLevel = "high" | "medium" | "low";
export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface VersionEvidence {
  source: "release" | "tag" | "manifest" | "readme" | "none";
  detail: string;
}

export interface CheckResult {
  id: string;
  title: string;
  /** Short description of what was checked */
  description: string;
  /** Whether this criterion is mandatory, recommended, or informative */
  requirementLevel?: RequirementLevel;
  status: CheckStatus;
  /** Detail message explaining why pass/fail */
  message: string;
  /** Optional evidence — file paths or URLs found */
  evidence?: string[];
  /** Link to the relevant Common Ground / standard reference */
  referenceUrl?: string;
  /** Optional confidence level for inferred/heuristic checks */
  confidence?: ConfidenceLevel;
  /** 1 to 5 stars; from the criterion's own scale, or derived from its status */
  starRating?: StarRating;
  /** Continuous rating from 0.5 to 5.5, for a criterion measured on a continuous scale */
  rating?: number;
  /** Ratings from 0.5 to 5.5 the check measures for aspects of the rating model, by key */
  aspectRatings?: Record<string, number | null>;
  /** The measured values behind the check's rating, with the thresholds per star level */
  measurements?: MeasurementGroup[];
  /** Informative metrics the check reports without rating them */
  metrics?: InformativeMetric[];
  /** Issue response and fix times against the proposed SLA terms; informative */
  sla?: SlaSummary;
}

/** A measured value that is shown with its explanation but earns no stars. */
export interface InformativeMetric {
  /** Stable kebab-case id, for example "contributor-absence-factor" */
  id: string;
  /** Name of the metric in its source model, for example "Contributor Absence Factor" */
  name: string;
  /** Definition of the metric */
  referenceUrl: string;
  /** The value as shown, or null when it was not measured */
  value: string | null;
  /** What the value means, or why it was not measured */
  explanation: string;
  /** The proposed KPI target and whether the value meets it; informative, never stars */
  target?: KpiResult;
}

/** A KPI target as shown, and whether the measured value meets it; null when it cannot be compared. */
export interface KpiResult {
  text: string;
  met: boolean | null;
}

/** Response or fix times of the issues of one category, in working days. */
export interface SlaTimes {
  /** Issues with a response or fix that was measured */
  measured: number;
  median: number | null;
  worst: number | null;
  /** Issues that missed the term, measured or still waiting */
  breaches: number;
  /** Issues still waiting for a response or fix */
  waiting: number;
}

/** The SLA measurement of one issue category. */
export interface SlaCategorySummary {
  category: string;
  label: string;
  respondDays: number | null;
  fixDays: number | "next-release" | null;
  count: number;
  /** Null when the response was not measured, as for security advisories */
  response: SlaTimes | null;
  /** Null when the category has no fix term */
  fix: SlaTimes | null;
}

/** An open issue past its response or fix due date. */
export interface SlaBreach {
  title: string;
  url: string;
  category: string;
  kind: "response" | "fix";
  due: string;
}

/** Issue response and fix times over open and recently closed issues. */
export interface SlaSummary {
  /** Why nothing was measured; null when it was */
  notMeasured: string | null;
  from: string;
  to: string;
  categories: SlaCategorySummary[];
  /** The open breaches, longest overdue first; at most 20 */
  openBreaches: SlaBreach[];
  /** All open breaches, also those not listed */
  openBreachCount: number;
  /** How fixes were dated: by the stable release after the closing change, or by closing as completed */
  fixesByRelease: number;
  fixesByClose: number;
  notes: string[];
}

/** A star level that has a threshold of its own; below 2 stars is 1 star. */
export type StarLevel = 5 | 4 | 3 | 2;

export const STAR_LEVELS: readonly StarLevel[] = [5, 4, 3, 2];

/** One measured value against the thresholds of the star levels. */
export interface MeasurementRow {
  /** What is measured, for example "Python, more than 15 lines" */
  label: string;
  /** The measured value as shown, for example "58.8%" */
  value: string;
  /** The threshold per star level as shown, for example "at most 48.0%"; a missing level has no threshold */
  thresholds: Partial<Record<StarLevel, string>>;
  /** The stars this value earns, or null when no level applies */
  stars: StarRating | null;
  /** Shown in place of the stars when they are null, for example "below 4 stars" */
  starsText?: string;
}

/** The measurements of one property of a check, for example unit size. */
export interface MeasurementGroup {
  /** Stable kebab-case id, for example "unit-size" */
  id: string;
  title: string;
  /** Keys in the check's `aspectRatings` this property counts in */
  aspects: string[];
  rows: MeasurementRow[];
}

export interface AspectRating {
  /** Rating from 0.5 to 5.5, or null when none of its inputs count */
  rating: number | null;
  /** For a document-count aspect: the inputs that pass */
  found?: number;
  /** For a document-count aspect: the inputs that were measured */
  expected?: number;
}

export interface Endorsement {
  /** No mandatory criterion fails and the overall rating is at least 2.5 */
  passed: boolean;
  reasons: string[];
}

/** Repository details read from publiccode.yml */
export interface PublicCodeDetails {
  displayName: string | null;
  shortDescription: string | null;
  /** Absolute http(s) URL of the logo */
  logoUrl: string | null;
  developmentStatus: string | null;
  maintenanceType: string | null;
  maintainers: string[];
}

export interface CheckReport {
  repoUrl: string;
  owner: string;
  repo: string;
  checkedAt: string;
  scoringConfigId: string | null;
  score: number; // 0-100
  /** Overall rating from 0.5 to 5.5, or null when no criterion counts */
  rating: number | null;
  /** Rating per category, or null for a category without counted criteria */
  categoryRatings: Record<string, number | null>;
  /** Rating per aspect id */
  aspectRatings: Record<string, AspectRating>;
  endorsement: Endorsement;
  results: CheckResult[];
  repoMeta: {
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
    topics: string[];
    license: string | null;
    version: string | null;
    versionEvidence: VersionEvidence;
  } & PublicCodeDetails;
}
