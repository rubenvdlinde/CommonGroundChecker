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
  /** Titles of mandatory criteria that could not be measured and were left out of the score */
  notMeasured: string[];
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
  };
}
