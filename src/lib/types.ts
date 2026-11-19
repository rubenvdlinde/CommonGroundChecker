// Shared types across checkers and UI

import type { ScanRefKind } from "./scanRef";

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
  /**
   * For a mandatory criterion in its transition period at the time of the check:
   * the date (YYYY-MM-DD) it becomes mandatory. Until then a fail is a warning.
   */
  mandatoryFrom?: string;
  /** True when the criterion does not apply to this component; it then counts in no score, rating or verdict */
  notApplicable?: boolean;
  /** For the publiccode criterion: every field the repository's publiccode.yml declares */
  publiccode?: PublicCodeData;
  /** For the usage criterion: what each source says about who uses the component */
  usage?: UsageData;
  /** Informative metrics the check reports without rating them */
  metrics?: InformativeMetric[];
  /** Issue response and fix times against the proposed SLA terms; informative */
  sla?: SlaSummary;
  /** Set when a scan of an unchanged commit copied this result from the analysis that measured it */
  reusedFrom?: ReusedFrom;
}

/** The analysis a reused result was measured in. */
export interface ReusedFrom {
  /** Id of that analysis, or null when the store gave none */
  analysisId: string | null;
  checkedAt: string;
  commit: string;
}

/** `full` when every check ran; `partial` when the code checks were reused. */
export type ScanMode = "full" | "partial";

/** The kind of evidence a usage source gives. */
export type UsageSourceKind = "declared" | "downloads" | "containers" | "ecosystem";

/** One count a usage source reports, for example "downloads last month". */
export interface UsageFigure {
  label: string;
  value: number;
}

/**
 * What one source says about the use of a component. Counts only: no names of
 * people, logins or e-mail addresses. Only the declared users list names, and
 * those are the organisations publiccode.yml names.
 */
export interface UsageSource {
  /** Stable id, for example "npm" or "dockerhub" */
  id: string;
  kind: UsageSourceKind;
  /** Name of the source as shown, for example "npm" */
  source: string;
  /** The package, app or image measured, or null for the repository itself */
  subject: string | null;
  /** Page of the subject at the source */
  url: string | null;
  /** Date of the measurement, YYYY-MM-DD */
  measuredAt: string;
  /** One line on what the figures do and do not say */
  caveat: string;
  figures: UsageFigure[];
  /** For declared users: the organisations named */
  names?: string[];
  /** Shown in place of the figures, when they would suggest more than they say */
  summary?: string;
  /** Why the source applies but could not be measured */
  notMeasured?: string;
}

export interface UsageData {
  sources: UsageSource[];
}

/** A named party in publiccode.yml, such as `organisation` or an entry of `fundedBy` */
export interface PublicCodeParty {
  name: string | null;
  uri: string | null;
}

export interface PublicCodeContractor {
  name: string | null;
  until: string | null;
  email: string | null;
  website: string | null;
}

export interface PublicCodeContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  affiliation: string | null;
}

export interface PublicCodeDependency {
  name: string | null;
  versionMin: string | null;
  versionMax: string | null;
  version: string | null;
  optional: boolean | null;
}

/** The `description` of publiccode.yml in one language */
export interface PublicCodeDescription {
  /** Language code, for example "nl" or "en" */
  language: string;
  localisedName: string | null;
  genericName: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  documentation: string | null;
  apiDocumentation: string | null;
  features: string[];
  /** Absolute http(s) URLs */
  screenshots: string[];
  videos: string[];
  awards: string[];
}

/** The fields of publiccode.yml, normalised; a field the file leaves out is null or empty */
export interface PublicCodeData {
  publiccodeYmlVersion: string | null;
  name: string | null;
  applicationSuite: string | null;
  url: string | null;
  landingURL: string | null;
  isBasedOn: string[];
  softwareVersion: string | null;
  releaseDate: string | null;
  /** Absolute http(s) URL */
  logo: string | null;
  platforms: string[];
  categories: string[];
  usedBy: string[];
  roadmap: string | null;
  developmentStatus: string | null;
  softwareType: string | null;
  /** The `id` of every `supports` entry: standards, regulations and the Common Ground layer */
  supports: string[];
  intendedAudience: {
    countries: string[];
    unsupportedCountries: string[];
    scope: string[];
  };
  descriptions: PublicCodeDescription[];
  legal: {
    license: string | null;
    mainCopyrightOwner: string | null;
    repoOwner: string | null;
    authorsFile: string | null;
  };
  maintenance: {
    type: string | null;
    contractors: PublicCodeContractor[];
    contacts: PublicCodeContact[];
  };
  localisation: {
    localisationReady: boolean | null;
    availableLanguages: string[];
  };
  dependsOn: {
    open: PublicCodeDependency[];
    proprietary: PublicCodeDependency[];
    hardware: PublicCodeDependency[];
  };
  organisation: PublicCodeParty | null;
  fundedBy: PublicCodeParty[];
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
  /** Suitable for Common Ground: no mandatory criterion fails, the overall rating is at least 2.5, the component has a valid maintenance contract and its estimated maintainability is at least 4 stars */
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
  /** The checklist version the analysis was measured against */
  checklistVersion: string;
  score: number; // 0-100
  /** Overall rating from 0.5 to 5.5, or null when no criterion counts */
  rating: number | null;
  /** Rating per category, or null for a category without counted criteria */
  categoryRatings: Record<string, number | null>;
  /** Rating per aspect id */
  aspectRatings: Record<string, AspectRating>;
  endorsement: Endorsement;
  results: CheckResult[];
  /** Branch or tag name that was scanned. */
  scannedRef: string;
  scannedRefKind: ScanRefKind;
  /** Commit SHA that was scanned, or null when the provider did not return one. */
  scannedCommit: string | null;
  /** Set when the requested ref could not be used, e.g. no release to scan. */
  scanRefWarning?: string;
  scanMode?: ScanMode;
  /** Why the scan was full or partial, for example "the commit changed" */
  scanModeReason?: string;
  /** Seconds from the start of the scan until its results were complete */
  scanDurationSeconds?: number;
  /** Hash of the checker's own version and its pinned tool versions */
  toolFingerprint?: string;
  /** Hash of the scan settings the code checks depend on */
  inputsFingerprint?: string;
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
