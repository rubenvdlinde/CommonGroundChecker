import { CATEGORY_ORDER, type CriteriaCategory } from "./criteria";

/** How an aspect is rated from the check results. */
export type AspectSource =
  /** The weighted mean of the criteria's ratings */
  | { type: "criteria"; checkIds: string[] }
  /** The share of the criteria that pass, in bands of 20% */
  | { type: "document-count"; checkIds: string[] }
  /** A rating the check reports for this aspect in its `aspectRatings` */
  | { type: "check-aspect"; checkId: string; key: string }
  /** Shown from the check's own data, such as its sources or informative metrics, never rated */
  | { type: "informative"; checkId: string }
  /** Not rated: the size a check measures, shown as lines of code and effort */
  | { type: "size"; checkId: string };

export interface AspectDefinition {
  /** Stable kebab-case id, also the anchor in /docs/<category-slug>#<aspect-id> */
  id: string;
  title: string;
  source: AspectSource;
  /** Weight in the category's mean; 0 shows the aspect without counting it. Defaults to 1. */
  weight?: number;
}

export interface CategoryAspects {
  category: string;
  aspects: AspectDefinition[];
}

function maintainabilityAspect(id: string, title: string): AspectDefinition {
  return { id, title, source: { type: "check-aspect", checkId: "maintainability", key: id } };
}

function openSourceHealthAspect(id: string, title: string, key: string): AspectDefinition {
  return { id, title, source: { type: "check-aspect", checkId: "opensourcehealth", key } };
}

/**
 * The aspects of every category and the criteria they are rated from. A
 * criterion counts where this model places it, whatever its display category.
 * Criteria that a scan does not produce are ignored.
 */
export const ASPECT_MODEL: CategoryAspects[] = [
  {
    category: "Governance",
    aspects: [
      {
        id: "licensing",
        title: "Licensing",
        source: { type: "criteria", checkIds: ["license", "eupllicense", "licenceconsistency", "spdxheaders"] },
      },
      {
        id: "ownership",
        title: "Ownership",
        source: { type: "criteria", checkIds: ["copyrightowner", "publiccode"] },
      },
      {
        id: "maintenance",
        title: "Maintenance",
        source: { type: "criteria", checkIds: ["maintenance"] },
      },
      {
        id: "community-documents",
        title: "Community documents",
        source: {
          type: "document-count",
          checkIds: ["documentation", "contributing", "codeofconduct", "security", "changelog"],
        },
      },
      {
        id: "usage-and-ecosystem",
        title: "Usage and ecosystem",
        source: { type: "informative", checkId: "usage" },
        weight: 0,
      },
      {
        id: "project-health",
        title: "Project health",
        source: { type: "informative", checkId: "projecthealth" },
        weight: 0,
      },
    ],
  },
  {
    category: "Security",
    aspects: [
      openSourceHealthAspect("vulnerabilities", "Vulnerabilities", "vulnerabilities"),
      openSourceHealthAspect("dependency-freshness", "Dependency freshness", "freshness"),
      openSourceHealthAspect("dependency-activity", "Dependency activity", "activity"),
      openSourceHealthAspect("dependency-licences", "Dependency licences", "licence"),
      openSourceHealthAspect("dependency-management", "Dependency management", "management"),
      {
        id: "container-images",
        title: "Container images",
        source: { type: "criteria", checkIds: ["artifacthub"] },
      },
      { id: "secrets", title: "Secrets", source: { type: "criteria", checkIds: ["secretscanning"] } },
      { id: "secure-coding", title: "Secure coding", source: { type: "criteria", checkIds: ["owaspsecurecoding"] } },
      {
        id: "supply-chain",
        title: "Supply chain",
        source: { type: "criteria", checkIds: ["openssfscorecard", "sbom"] },
      },
    ],
  },
  {
    category: "Architecture",
    aspects: [
      { id: "api", title: "API", source: { type: "criteria", checkIds: ["openapi", "adrvalidator"] } },
      { id: "layering", title: "Layering", source: { type: "criteria", checkIds: ["fivelayer"] }, weight: 0 },
      { id: "standards", title: "Standards", source: { type: "criteria", checkIds: ["standards"] }, weight: 0 },
    ],
  },
  {
    category: "Maintainability",
    aspects: [
      maintainabilityAspect("analysability", "Analysability"),
      maintainabilityAspect("modifiability", "Modifiability"),
      maintainabilityAspect("testability", "Testability"),
      maintainabilityAspect("modularity", "Modularity"),
      maintainabilityAspect("reusability", "Reusability"),
      {
        id: "testing",
        title: "Testing",
        source: { type: "criteria", checkIds: ["tests", "coverage", "testcoderatio"] },
      },
      { id: "size", title: "Size", source: { type: "size", checkId: "size" }, weight: 0 },
    ],
  },
  {
    category: "Deployment & Operations",
    aspects: [
      {
        id: "containerisation",
        title: "Containerisation",
        source: { type: "document-count", checkIds: ["docker", "dockerimage", "helmchart"] },
      },
      {
        id: "release-management",
        title: "Release management",
        source: { type: "criteria", checkIds: ["cicd", "semver"] },
      },
    ],
  },
  {
    category: "AI readiness",
    aspects: [
      { id: "agent-instructions", title: "Instructions", source: { type: "criteria", checkIds: ["agentinstructions"] } },
      {
        id: "specifications-and-decisions",
        title: "Specifications and decisions",
        source: { type: "criteria", checkIds: ["specifications", "architecturedecisions"] },
      },
      {
        id: "runnable-environment",
        title: "Runnable environment",
        source: { type: "criteria", checkIds: ["devenvironment"] },
      },
      {
        id: "interfaces-and-tooling",
        title: "Interfaces and tooling",
        source: { type: "criteria", checkIds: ["machineinterfaces", "agenttooling"] },
      },
    ],
  },
];

/** Earlier names of categories in the model, for a base that still uses them. */
const PREVIOUS_CATEGORY_NAMES: Record<string, string> = {
  Maintainability: "Software Quality",
};

/** The category in CATEGORY_ORDER that a category of the model rates, if any. */
export function resolveCategory(name: string): CriteriaCategory | undefined {
  const categories: readonly string[] = CATEGORY_ORDER;
  if (categories.includes(name)) return name as CriteriaCategory;
  const previous = PREVIOUS_CATEGORY_NAMES[name];
  return previous && categories.includes(previous) ? (previous as CriteriaCategory) : undefined;
}
