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
  "copyrightowner",
  "publiccode",
  "maintenance",
  "usage",
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
  "codemetrics",
  "owaspsecurecoding",
  "contributing",
  "codeofconduct",
  "security",
  "projecthealth",
  "semver",
];

export const RESULT_CATEGORY_BY_ID: Record<string, CriteriaCategory> = {
  sourcecode: "Software Quality",
  openapi: "Architecture",
  adrvalidator: "Architecture",
  license: "Governance",
  eupllicense: "Governance",
  copyrightowner: "Governance",
  publiccode: "Governance",
  maintenance: "Governance",
  usage: "Governance",
  docker: "Deployment & Operations",
  dockerimage: "Deployment & Operations",
  cicd: "Deployment & Operations",
  helmchart: "Deployment & Operations",
  sbom: "Software Quality",
  documentation: "Software Quality",
  changelog: "Software Quality",
  tests: "Software Quality",
  coverage: "Software Quality",
  complexity: "Software Quality",
  maintainability: "Software Quality",
  codemetrics: "Software Quality",
  owaspsecurecoding: "Security",
  contributing: "Governance",
  codeofconduct: "Governance",
  projecthealth: "Governance",
  security: "Security",
  semver: "Software Quality",
  fivelayer: "Architecture",
};

/** DOM id of a criterion's result card, used as the target of links to it. */
export function criterionAnchorId(id: string): string {
  return `criterion-${id}`;
}
