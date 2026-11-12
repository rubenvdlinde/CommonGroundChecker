export type CriteriaCategory =
  | "Governance"
  | "Security"
  | "Architecture"
  | "Maintainability"
  | "Deployment & Operations";

export const CATEGORY_ORDER: CriteriaCategory[] = [
  "Governance",
  "Security",
  "Architecture",
  "Maintainability",
  "Deployment & Operations",
];

export type CategoryWeights = Record<CriteriaCategory, number>;

export const CATEGORY_WEIGHTS: CategoryWeights = {
  Governance: 0.2,
  Architecture: 0.2,
  Security: 0.25,
  "Deployment & Operations": 0.2,
  Maintainability: 0.15,
};

/** Category names used by earlier versions, mapped to the category that replaced them. */
export const LEGACY_CATEGORY_NAMES: Record<string, CriteriaCategory> = {
  "Software Quality": "Maintainability",
};

/**
 * Renames legacy category keys in stored category weights. A legacy weight is
 * only used when the replacing category has no weight of its own.
 */
export function migrateLegacyCategoryWeights<T>(
  weights: Record<string, T>
): Record<string, T> {
  const migrated: Record<string, T> = {};
  for (const [category, weight] of Object.entries(weights)) {
    if (!(category in LEGACY_CATEGORY_NAMES)) {
      migrated[category] = weight;
    }
  }
  for (const [legacy, current] of Object.entries(LEGACY_CATEGORY_NAMES)) {
    if (legacy in weights && !(current in weights)) {
      migrated[current] = weights[legacy];
    }
  }
  return migrated;
}

export const RESULT_ORDER_BY_ID: string[] = [
  "sourcecode",
  "fivelayer",
  "license",
  "eupllicense",
  "licenceconsistency",
  "copyrightowner",
  "spdxheaders",
  "publiccode",
  "docker",
  "dockerimage",
  "cicd",
  "openapi",
  "adrvalidator",
  "helmchart",
  "sbom",
  "documentation",
  "changelog",
  "tests",
  "coverage",
  "complexity",
  "maintainability",
  "opensourcehealth",
  "testcoderatio",
  "codemetrics",
  "owaspsecurecoding",
  "contributing",
  "codeofconduct",
  "security",
  "secretscanning",
  "openssfscorecard",
  "semver",
];

export const RESULT_CATEGORY_BY_ID: Record<string, CriteriaCategory> = {
  sourcecode: "Maintainability",
  openapi: "Architecture",
  adrvalidator: "Architecture",
  license: "Governance",
  eupllicense: "Governance",
  licenceconsistency: "Governance",
  copyrightowner: "Governance",
  spdxheaders: "Governance",
  publiccode: "Governance",
  docker: "Deployment & Operations",
  dockerimage: "Deployment & Operations",
  cicd: "Deployment & Operations",
  helmchart: "Deployment & Operations",
  sbom: "Security",
  documentation: "Governance",
  changelog: "Governance",
  tests: "Maintainability",
  coverage: "Maintainability",
  complexity: "Maintainability",
  maintainability: "Maintainability",
  opensourcehealth: "Security",
  testcoderatio: "Maintainability",
  codemetrics: "Maintainability",
  owaspsecurecoding: "Security",
  contributing: "Governance",
  codeofconduct: "Governance",
  security: "Security",
  secretscanning: "Security",
  openssfscorecard: "Security",
  semver: "Deployment & Operations",
  fivelayer: "Architecture",
};

/** DOM id of a criterion's result card, used as the target of links to it. */
export function criterionAnchorId(id: string): string {
  return `criterion-${id}`;
}
