import type { CheckResult } from "./types";

export type CriteriaCategory =
  | "Governance"
  | "Security"
  | "Architecture"
  | "Software Quality"
  | "Deployment & Operations";

export const CATEGORY_ORDER: CriteriaCategory[] = [
  "Governance",
  "Security",
  "Architecture",
  "Software Quality",
  "Deployment & Operations",
];

export type CategoryWeights = Record<CriteriaCategory, number>;

export const CATEGORY_WEIGHTS: CategoryWeights = {
  Governance: 0.2,
  Architecture: 0.2,
  Security: 0.25,
  "Deployment & Operations": 0.2,
  "Software Quality": 0.15,
};

export const RESULT_ORDER_BY_ID: string[] = [
  "sourcecode",
  "fivelayer",
  "license",
  "eupllicense",
  "licenceconsistency",
  "copyrightowner",
  "spdxheaders",
  "publiccode",
  "maintenance",
  "usage",
  "docker",
  "dockerimage",
  "cicd",
  "openapi",
  "adrvalidator",
  "standards",
  "helmchart",
  "sbom",
  "artifacthub",
  "documentation",
  "changelog",
  "tests",
  "coverage",
  "complexity",
  "maintainability",
  "testcoderatio",
  "codemetrics",
  "owaspsecurecoding",
  "contributing",
  "codeofconduct",
  "security",
  "projecthealth",
  "secretscanning",
  "openssfscorecard",
  "semver",
];

export const RESULT_CATEGORY_BY_ID: Record<string, CriteriaCategory> = {
  sourcecode: "Software Quality",
  openapi: "Architecture",
  adrvalidator: "Architecture",
  standards: "Architecture",
  license: "Governance",
  eupllicense: "Governance",
  licenceconsistency: "Governance",
  copyrightowner: "Governance",
  spdxheaders: "Governance",
  publiccode: "Governance",
  maintenance: "Governance",
  usage: "Governance",
  docker: "Deployment & Operations",
  dockerimage: "Deployment & Operations",
  cicd: "Deployment & Operations",
  helmchart: "Deployment & Operations",
  sbom: "Software Quality",
  artifacthub: "Security",
  documentation: "Software Quality",
  changelog: "Software Quality",
  tests: "Software Quality",
  coverage: "Software Quality",
  complexity: "Software Quality",
  maintainability: "Software Quality",
  testcoderatio: "Software Quality",
  codemetrics: "Software Quality",
  owaspsecurecoding: "Security",
  contributing: "Governance",
  codeofconduct: "Governance",
  projecthealth: "Governance",
  security: "Security",
  secretscanning: "Security",
  openssfscorecard: "Security",
  semver: "Software Quality",
  fivelayer: "Architecture",
};

/** DOM id of a criterion's result card, used as the target of links to it. */
export function criterionAnchorId(id: string): string {
  return `criterion-${id}`;
}

/** Path of a criterion's page in the rating guide. */
export function criterionDocHref(id: string): string {
  return `/docs/criteria/${id}`;
}

/**
 * The version of the checklist: its criteria, requirement levels, thresholds
 * and weights. A change accepted through the change process gets a new
 * version, and every analysis records the version it was measured against.
 */
export const CHECKLIST_VERSION = "2026.2";

/** The issue form for a proposal to change the checklist. */
export const CHECKLIST_CHANGE_PROPOSAL_URL =
  "https://github.com/Hugo-ter-Doest/CommonGroundChecker/issues/new?template=checklist-change.yml";

export interface CriterionVersion {
  /** The checklist version the criterion was introduced in */
  introducedIn: string;
  /**
   * The date (YYYY-MM-DD) from which a mandatory criterion counts as mandatory.
   * Before it, a fail is a warning: it does not fail the mandatory set and
   * does not block the verdict.
   */
  mandatoryFrom?: string;
}

export type CriterionVersions = Record<string, CriterionVersion>;

export const CRITERION_VERSIONS: CriterionVersions = {
  sourcecode: { introducedIn: "2026.1" },
  fivelayer: { introducedIn: "2026.1" },
  license: { introducedIn: "2026.1" },
  eupllicense: { introducedIn: "2026.1" },
  copyrightowner: { introducedIn: "2026.1" },
  publiccode: { introducedIn: "2026.1" },
  maintenance: { introducedIn: "2026.1" },
  docker: { introducedIn: "2026.1" },
  dockerimage: { introducedIn: "2026.1" },
  cicd: { introducedIn: "2026.1" },
  openapi: { introducedIn: "2026.1" },
  adrvalidator: { introducedIn: "2026.1" },
  standards: { introducedIn: "2026.2" },
  helmchart: { introducedIn: "2026.1" },
  sbom: { introducedIn: "2026.1" },
  artifacthub: { introducedIn: "2026.2", mandatoryFrom: "2027-05-19" },
  documentation: { introducedIn: "2026.1" },
  changelog: { introducedIn: "2026.1" },
  tests: { introducedIn: "2026.1" },
  coverage: { introducedIn: "2026.1" },
  complexity: { introducedIn: "2026.1" },
  maintainability: { introducedIn: "2026.1" },
  codemetrics: { introducedIn: "2026.1" },
  owaspsecurecoding: { introducedIn: "2026.1" },
  contributing: { introducedIn: "2026.1" },
  codeofconduct: { introducedIn: "2026.1" },
  security: { introducedIn: "2026.1" },
  semver: { introducedIn: "2026.1" },
  usage: { introducedIn: "2026.2" },
  projecthealth: { introducedIn: "2026.2" },
};

/** The start of a YYYY-MM-DD date in UTC, or null for anything else. */
function parseDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : parsed;
}

/** True for a valid YYYY-MM-DD date. */
export function isMandatoryFromDate(value: unknown): value is string {
  return typeof value === "string" && parseDate(value) !== null;
}

/**
 * The date a mandatory criterion becomes mandatory, when that date is still
 * after `now`. Null when the criterion is not mandatory, has no such date, or
 * already counts as mandatory.
 */
export function upcomingMandatoryFrom(
  result: Pick<CheckResult, "id" | "requirementLevel">,
  now: Date,
  versions: CriterionVersions = CRITERION_VERSIONS
): string | null {
  if (result.requirementLevel !== "mandatory") return null;
  const mandatoryFrom = versions[result.id]?.mandatoryFrom;
  if (!mandatoryFrom) return null;
  const date = parseDate(mandatoryFrom);
  return date && now.getTime() < date.getTime() ? mandatoryFrom : null;
}

/** A result with its transition date when, at `now`, it is a mandatory criterion that is not mandatory yet. */
export function withTransition<T extends Pick<CheckResult, "id" | "requirementLevel" | "mandatoryFrom">>(
  result: T,
  now: Date,
  versions: CriterionVersions = CRITERION_VERSIONS
): T {
  const mandatoryFrom = upcomingMandatoryFrom(result, now, versions);
  return mandatoryFrom === null ? result : { ...result, mandatoryFrom };
}

/** True for a mandatory criterion in its transition period: it does not count as mandatory yet. */
export function isInTransition(result: Pick<CheckResult, "requirementLevel" | "mandatoryFrom">): boolean {
  return result.requirementLevel === "mandatory" && isMandatoryFromDate(result.mandatoryFrom);
}

/** "Becomes mandatory on 1 March 2027" */
export function transitionNotice(mandatoryFrom: string): string {
  const date = parseDate(mandatoryFrom);
  const formatted = date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : mandatoryFrom;
  return `Becomes mandatory on ${formatted}`;
}

/** "Measured against checklist version 2026.1", or "version unknown" for an analysis from before the checklist had versions. */
export function checklistVersionLabel(version: string | null | undefined): string {
  return version ? `Measured against checklist version ${version}` : "Measured against checklist version unknown";
}
