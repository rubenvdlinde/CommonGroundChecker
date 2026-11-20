/** The Standard for Public Code of the Foundation for Public Code. */
export const STANDARD_FOR_PUBLIC_CODE_URL = "https://standard.publiccode.net/";

export type SfpcCriterionId =
  | "code-in-the-open"
  | "bundle-policy-and-source-code"
  | "make-the-codebase-reusable-and-portable"
  | "welcome-contributors"
  | "make-contributing-easy"
  | "maintain-version-control"
  | "require-review-of-contributions"
  | "document-codebase-objectives"
  | "document-the-code"
  | "use-plain-english"
  | "use-open-standards"
  | "use-continuous-integration"
  | "publish-with-an-open-license"
  | "make-the-codebase-findable"
  | "use-a-coherent-style"
  | "document-codebase-maturity";

export interface SfpcCriterion {
  id: SfpcCriterionId;
  title: string;
  /** Why no criterion of the checker covers it; set only for a criterion the checker does not measure */
  notMeasured?: string;
}

/** The sixteen criteria of the Standard for Public Code, in the order of the standard. */
export const SFPC_CRITERIA: SfpcCriterion[] = [
  { id: "code-in-the-open", title: "Code in the open" },
  {
    id: "bundle-policy-and-source-code",
    title: "Bundle policy and source code",
    notMeasured: "The policy a codebase carries out is a document outside the code. No tool can find it.",
  },
  { id: "make-the-codebase-reusable-and-portable", title: "Make the codebase reusable and portable" },
  { id: "welcome-contributors", title: "Welcome contributors" },
  {
    id: "make-contributing-easy",
    title: "Make contributing easy",
    notMeasured:
      "No criterion tests whether the issue tracker is public and open to anyone. Project health shows response times, for information only.",
  },
  { id: "maintain-version-control", title: "Maintain version control" },
  {
    id: "require-review-of-contributions",
    title: "Require review of contributions",
    notMeasured: "Whether every change gets a review is a way of working. The checker does not count reviews.",
  },
  {
    id: "document-codebase-objectives",
    title: "Document codebase objectives",
    notMeasured: "The checker shows the description in publiccode.yml, but it does not judge whether the goals are clear.",
  },
  { id: "document-the-code", title: "Document the code" },
  {
    id: "use-plain-english",
    title: "Use plain English",
    notMeasured: "Plain language takes a reader. A tool cannot judge it.",
  },
  { id: "use-open-standards", title: "Use open standards" },
  { id: "use-continuous-integration", title: "Use continuous integration" },
  { id: "publish-with-an-open-license", title: "Publish with an open license" },
  { id: "make-the-codebase-findable", title: "Make the codebase findable" },
  {
    id: "use-a-coherent-style",
    title: "Use a coherent style",
    notMeasured: "Every language and team has its own style guide. The checker does not pick one.",
  },
  { id: "document-codebase-maturity", title: "Document codebase maturity" },
];

/** The page of one criterion on standard.publiccode.net. */
export function sfpcCriterionUrl(id: SfpcCriterionId): string {
  return `${STANDARD_FOR_PUBLIC_CODE_URL}criteria/${id}.html`;
}

export function findSfpcCriterion(id: SfpcCriterionId): SfpcCriterion {
  const criterion = SFPC_CRITERIA.find((candidate) => candidate.id === id);
  if (!criterion) throw new Error(`no Standard for Public Code criterion ${id}`);
  return criterion;
}
