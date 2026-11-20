import {
  FAMILY_LABELS,
  HOURS_PER_PERSON_YEAR,
  ISBSG_HOURS_PER_FUNCTION_POINT,
  QSM_LINES_PER_FUNCTION_POINT,
  SIG_V17_LINES_PER_PERSON_YEAR,
  formatCount,
  type SizeFactor,
} from "./size";
import type { SizeFamily } from "./types";

/** A public document that an aspect's description is based on. */
export interface DocSource {
  title: string;
  url: string;
}

/** A criterion of the checker that feeds an aspect, and the tool that measures it. */
export interface MeasuredCriterion {
  /** Id of the check result, as used in the scoring configuration */
  checkId: string;
  name: string;
  tool: string;
}

/** The code properties the Maintainability (ISO 25010) check measures. */
export type CodePropertyId =
  | "duplication"
  | "unit-size"
  | "unit-complexity"
  | "unit-interfacing"
  | "module-coupling"
  | "component-independence"
  | "component-entanglement";

export interface CodePropertyDoc {
  id: CodePropertyId;
  title: string;
  /** What share or degree of the code is measured */
  measures: string;
  /** The limit for 4 stars, published in the maintainability guidance */
  fourStars: string;
  /** Limits for 5, 3 and 2 stars, derived by the checker; null where no level is estimated */
  derived: { fiveStars: string; threeStars: string | null; twoStars: string | null };
}

export interface RatingAspectDoc {
  /** Stable kebab-case id, used as the anchor in /docs/<category-slug>#<aspect-id> */
  id: string;
  title: string;
  /** What the aspect means */
  meaning: string;
  /** The criteria the aspect is rated from */
  criteria: MeasuredCriterion[];
  /** How the checker gets from the measurement to 1 to 5 stars */
  rating: string[];
  /** The code properties a maintainability sub-characteristic is measured through */
  properties?: CodePropertyId[];
  /** False when the aspect is shown but does not count in the category rating */
  counted: boolean;
  /** True when the aspect is shown for information only and never rated */
  informative?: boolean;
  /** A table of the factors the aspect is computed with */
  factors?: FactorTable;
  sources: DocSource[];
}

export interface FactorTable {
  caption: string;
  columns: string[];
  /** Per row: the row header, then one cell per remaining column */
  rows: string[][];
}

export interface RatingCategoryDoc {
  /** Stable slug, the path in /docs/<category-slug> */
  slug: string;
  title: string;
  summary: string;
  aspects: RatingAspectDoc[];
}

const SOURCES = {
  agentsMd: { title: "AGENTS.md, a format for instructions to coding agents", url: "https://agents.md/" },
  openSpec: { title: "OpenSpec: spec-driven development for coding agents", url: "https://github.com/Fission-AI/OpenSpec" },
  specKit: { title: "GitHub Spec Kit", url: "https://github.com/github/spec-kit" },
  adr: { title: "Architecture decision records", url: "https://adr.github.io/" },
  devContainers: { title: "Development Containers specification", url: "https://containers.dev/" },
  llmsTxt: { title: "The /llms.txt file", url: "https://llmstxt.org/" },
  mcp: { title: "Model Context Protocol", url: "https://modelcontextprotocol.io/" },
  chaossMetrics: { title: "CHAOSS metrics and metrics models", url: "https://chaoss.community/kb-metrics-and-metrics-models/" },
  chaossAbsenceFactor: {
    title: "CHAOSS: Contributor Absence Factor",
    url: "https://chaoss.community/kb/metric-contributor-absence-factor/",
  },
  chaossOrganizationalDiversity: {
    title: "CHAOSS: Organizational Diversity",
    url: "https://chaoss.community/kb/metric-organizational-diversity/",
  },
  chaossClosureRatio: {
    title: "CHAOSS: Change Request Closure Ratio",
    url: "https://chaoss.community/kb/metric-change-request-closure-ratio/",
  },
  chaossFirstResponse: {
    title: "CHAOSS: Time to First Response",
    url: "https://chaoss.community/kb/metric-time-to-first-response/",
  },
  chaossIssueResponse: { title: "CHAOSS: Issue Response Time", url: "https://chaoss.community/kb/metric-issue-response-time/" },
  chaossReleaseFrequency: { title: "CHAOSS: Release Frequency", url: "https://chaoss.community/kb/metric-release-frequency/" },
  iso25010: { title: "ISO/IEC 25010 product quality model", url: "https://iso25000.com/index.php/en/iso-25000-standards/iso-25010" },
  qualityModels: {
    title: "SIG quality models",
    url: "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/sig-quality-models.md",
  },
  maintainabilityCriteria: {
    title: "Evaluation criteria Trusted Product Maintainability (PDF)",
    url: "https://www.softwareimprovementgroup.com/wp-content/uploads/SIG-TUViT-Evaluation-Criteria-Trusted-Product-Maintainability.pdf",
  },
  maintainabilityGuidance: {
    title: "Trusted Product Maintainability, guidance for producers (PDF)",
    url: "https://softwareimprovementgroup.com/wp-content/uploads/SIG-TUViT-Evaluation-Criteria-Trusted-Product-Maintainability-Guidance-for-producers.pdf",
  },
  heitlager: {
    title: "Heitlager, Kuipers and Visser (2007), A practical model for measuring maintainability",
    url: "https://ieeexplore.ieee.org/document/4335232",
  },
  heitlagerPdf: {
    title: "A practical model for measuring maintainability, full text (PDF)",
    url: "https://softwareimprovementgroup.com/wp-content/uploads/APracticalModelForMeasuringMaintainability.pdf",
  },
  benchmark: {
    title: "How the benchmark works (5%, 30%, 30%, 30%, 5%)",
    url: "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/getting-started/approach.md",
  },
  maintainabilityBands: {
    title: "Maintainability bands used by the checker",
    url: "https://github.com/ConductionNL/.github/blob/main/docs/hydra/operations/sig-scores.mdx",
  },
  lizard: { title: "lizard, code complexity analyser", url: "https://github.com/terryyin/lizard" },
  jscpd: { title: "jscpd, copy and paste detector", url: "https://github.com/kucherenko/jscpd" },
  scc: { title: "scc, Sloc Cloc and Code, version 4.1.0", url: "https://github.com/boyter/scc/releases/tag/v4.1.0" },
  qsmLanguages: {
    title: "QSM Function Point Languages Table, version 5.0",
    url: "https://www.qsm.com/resources/function-point-languages-table",
  },
  isbsgDeliveryRate: {
    title: "ISBSG (2010), the impact of team size and software size on project delivery rate (PDF)",
    url: "https://isbsg.org/wp-content/uploads/2017/03/The-impact-of-team-size-and-software-size-on-project-delivery-rate-2010.pdf",
  },
  maintainabilityGuidanceV17: {
    title: "Trusted Product Maintainability, guidance for producers v17.0 (PDF, web archive)",
    url: "https://web.archive.org/web/20250826/https://softwareimprovementgroup.com/wp-content/uploads/SIG-TUViT-Evaluation-Criteria-Trusted-Product-Maintainability-Guidance-for-producers.pdf",
  },
  sigrid2026Model: {
    title: "Sigrid 2026 model changes: volume no longer counts towards the maintainability rating",
    url: "https://docs.sigrid-says.com/reference/quality-model-documents/2026-model-changes.html",
  },
  sigridDefaultExcludes: {
    title: "Sigrid default excludes",
    url: "https://github.com/Software-Improvement-Group/sigridci/blob/main/resources/default-excludes.txt",
  },
  testCodeRatio: {
    title: "Test code ratio and its relation to coverage",
    url: "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/capabilities/system-maintainability.md",
  },
  openSourceHealth: {
    title: "Open Source Health, guidance for producers",
    url: "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/quality-model-documents/open-source-health.md",
  },
  osv: { title: "OSV.dev, open source vulnerability database", url: "https://osv.dev/" },
  osvApi: { title: "OSV.dev API", url: "https://google.github.io/osv.dev/api/" },
  gitleaks: { title: "gitleaks", url: "https://github.com/gitleaks/gitleaks" },
  cwe798: { title: "CWE-798: use of hard-coded credentials", url: "https://cwe.mitre.org/data/definitions/798.html" },
  owaspSecrets: {
    title: "OWASP secrets management cheat sheet",
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
  },
  owaspSecureCoding: {
    title: "OWASP secure coding practices quick reference guide",
    url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/",
  },
  owaspTop10: { title: "OWASP Top 10", url: "https://owasp.org/Top10/" },
  scorecard: { title: "OpenSSF Scorecard", url: "https://scorecard.dev/" },
  scorecardChecks: {
    title: "OpenSSF Scorecard checks",
    url: "https://github.com/ossf/scorecard/blob/main/docs/checks.md",
  },
  spdxSpecs: { title: "SPDX specifications", url: "https://spdx.dev/use/specifications/" },
  artifactHubSecurity: {
    title: "Artifact Hub, packages security report",
    url: "https://artifacthub.io/docs/topics/security_report/",
  },
  artifactHubImages: {
    title: "Artifact Hub Helm annotations, artifacthub.io/images",
    url: "https://artifacthub.io/docs/topics/annotations/helm/",
  },
  trivy: { title: "Trivy", url: "https://trivy.dev/" },
  cyclonedx: { title: "CycloneDX specification", url: "https://cyclonedx.org/specification/overview/" },
  osiLicences: { title: "OSI approved licences", url: "https://opensource.org/licenses" },
  eupl: {
    title: "European Union Public Licence 1.2",
    url: "https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12",
  },
  spdxLicences: { title: "SPDX licence list", url: "https://spdx.org/licenses/" },
  spdxIdentifiers: {
    title: "SPDX short identifiers in source files",
    url: "https://spdx.github.io/spdx-spec/v2.3/using-SPDX-short-identifiers-in-source-files/",
  },
  reuse: { title: "REUSE specification 3.3", url: "https://reuse.software/spec-3.3/" },
  publicCodeLicence: {
    title: "Standard for Public Code: publish with an open licence",
    url: "https://standard.publiccode.net/criteria/publish-with-an-open-license.html",
  },
  publicCodeFindable: {
    title: "Standard for Public Code: make the codebase findable",
    url: "https://standard.publiccode.net/criteria/make-the-codebase-findable.html",
  },
  publicCodeContributing: {
    title: "Standard for Public Code: make contributing easy",
    url: "https://standard.publiccode.net/criteria/make-contributing-easy.html",
  },
  publicCodeDocument: {
    title: "Standard for Public Code: document the code",
    url: "https://standard.publiccode.net/criteria/document-the-code.html",
  },
  publicCodeCi: {
    title: "Standard for Public Code: use continuous integration",
    url: "https://standard.publiccode.net/criteria/use-continuous-integration.html",
  },
  publiccodeYml: { title: "publiccode.yml specification", url: "https://yml.publiccode.tools/" },
  publiccodeMaintenance: {
    title: "publiccode.yml specification: maintenance",
    url: "https://publiccodeyml.github.io/v0/schema.core.html#section-maintenance",
  },
  publiccodeUsedBy: {
    title: "publiccode.yml specification: usedBy (deprecated)",
    url: "https://publiccodeyml.github.io/v0/schema.core.html#key-usedby-deprecated",
  },
  npmDownloads: { title: "npm download counts API", url: "https://github.com/npm/registry/blob/main/docs/download-counts.md" },
  packagistApi: { title: "Packagist API", url: "https://packagist.org/apidoc" },
  pypistats: { title: "pypistats.org API", url: "https://pypistats.org/api/" },
  nextcloudAppStoreApi: {
    title: "Nextcloud App Store REST API",
    url: "https://nextcloudappstore.readthedocs.io/en/latest/api/restapi.html",
  },
  githubReleaseAssets: {
    title: "GitHub Docs: release assets and their download count",
    url: "https://docs.github.com/en/rest/releases/assets",
  },
  dockerHubApi: { title: "Docker Hub API", url: "https://docs.docker.com/reference/api/hub/latest/" },
  depsDevApi: { title: "deps.dev API", url: "https://docs.deps.dev/api/v3alpha/" },
  githubContributors: {
    title: "GitHub Docs: list repository contributors",
    url: "https://docs.github.com/en/rest/repos/repos#list-repository-contributors",
  },
  ossRegister: { title: "Open Source Register (developer.overheid.nl)", url: "https://oss.developer.overheid.nl/" },
  legalGuide: { title: "Open Source Guides: the legal side of open source", url: "https://opensource.guide/legal/" },
  contributingGuide: {
    title: "GitHub Docs: setting guidelines for repository contributors",
    url: "https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors",
  },
  codeOfConduct: { title: "Open Source Guides: your code of conduct", url: "https://opensource.guide/code-of-conduct/" },
  securityPolicy: {
    title: "GitHub Docs: adding a security policy to your repository",
    url: "https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository",
  },
  changelog: { title: "Keep a Changelog", url: "https://keepachangelog.com/en/1.1.0/" },
  composeModel: {
    title: "Docker Docs: the Compose application model and file names",
    url: "https://docs.docker.com/compose/intro/compose-application-model/",
  },
  dockerfile: { title: "Dockerfile reference", url: "https://docs.docker.com/reference/dockerfile/" },
  helmCharts: { title: "Helm: charts", url: "https://helm.sh/docs/topics/charts/" },
  haven: { title: "Haven, the Common Ground hosting standard", url: "https://haven.commonground.nl/" },
  githubActions: {
    title: "GitHub Docs: understanding GitHub Actions",
    url: "https://docs.github.com/en/actions/get-started/understand-github-actions",
  },
  semver: { title: "Semantic Versioning 2.0.0", url: "https://semver.org/" },
  openApi: { title: "OpenAPI Specification", url: "https://spec.openapis.org/oas/latest.html" },
  apiDesignRules: { title: "NL API Design Rules (Logius)", url: "https://gitdocumentatie.logius.nl/publicatie/api/adr/" },
  apiDesignRulesRepo: {
    title: "NL API Design Rules, source and rule sets",
    url: "https://github.com/Logius-standaarden/API-Design-Rules",
  },
  spectral: { title: "Spectral, the OpenAPI linter", url: "https://github.com/stoplightio/spectral" },
  publiccodeSupports: {
    title: "publiccode.yml standard, the supports key",
    url: "https://publiccodeyml.github.io/v0/schema.core.html#key-supports",
  },
  fiveLayerModel: {
    title: "Common Ground five-layer model (GEMMA Online)",
    url: "https://www.gemmaonline.nl/wiki/Common_Ground_vijflaagsmodel",
  },
} satisfies Record<string, DocSource>;

/**
 * The code properties behind the maintainability sub-characteristics, with
 * their star limits. Shares are the part of the code above each bound.
 */
export const CODE_PROPERTIES: CodePropertyDoc[] = [
  {
    id: "duplication",
    title: "Duplication",
    measures: "Share of code lines in a block of 6 or more lines that occurs more than once",
    fourStars: "5.8%",
    derived: { fiveStars: "3.5%", threeStars: "11.6%", twoStars: "23%" },
  },
  {
    id: "unit-size",
    title: "Unit size",
    measures: "Share of code in units (functions and methods) of more than 15, 30 and 60 lines",
    fourStars: "48.0% / 24.2% / 9.1%",
    derived: { fiveStars: "36.0% / 17.0% / 5.5%", threeStars: "63.0% / 34.7% / 15.4%", twoStars: "84.7% / 49.0% / 25.3%" },
  },
  {
    id: "unit-complexity",
    title: "Unit complexity",
    measures: "Share of code in units with a McCabe complexity over 5, 10 and 25",
    fourStars: "20.7% / 7.5% / 1.1%",
    derived: { fiveStars: "15.8% / 4.4% / 0.5%", threeStars: "27.7% / 10.6% / 1.7%", twoStars: "34.6% / 13.2% / 2.7%" },
  },
  {
    id: "unit-interfacing",
    title: "Unit interfacing",
    measures: "Share of code in units with 3 or more, 5 or more and 7 or more parameters",
    fourStars: "15.4% / 3.4% / 0.9%",
    derived: { fiveStars: "12.5% / 2.5% / 0.6%", threeStars: "18.3% / 4.8% / 1.4%", twoStars: "26.0% / 7.2% / 2.1%" },
  },
  {
    id: "module-coupling",
    title: "Module coupling",
    measures: "Share of code in modules (files) used by more than 10, 20 and 50 other modules (fan-in)",
    fourStars: "9.7% / 5.3% / 1.8%",
    derived: { fiveStars: "7.4% / 3.3% / 1.2%", threeStars: "10.7% / 5.9% / 2.3%", twoStars: "13.0% / 8.0% / 3.8%" },
  },
  {
    id: "component-independence",
    title: "Component independence",
    measures: "Share of code that is not called from outside its own component",
    fourStars: "at least 94.5%",
    derived: { fiveStars: "at least 97.3%", threeStars: null, twoStars: null },
  },
  {
    id: "component-entanglement",
    title: "Component entanglement",
    measures: "Degree to which dependencies between components break the intended structure",
    fourStars: "at most 0.075",
    derived: { fiveStars: "at most 0.0375", threeStars: null, twoStars: null },
  },
];

const MAINTAINABILITY_CRITERION: MeasuredCriterion = {
  checkId: "maintainability",
  name: "Maintainability (ISO 25010)",
  tool: "lizard 1.24.3 and jscpd 4.0.5, through a vendored analysis script",
};

const SUBCHARACTERISTIC_RATING = [
  "The Maintainability (ISO 25010) check measures each code property on the source code in PHP, JavaScript, TypeScript, Vue and Python. Test code, vendored code and build output are left out. Module coupling and the component properties are measured for PHP and Python only.",
  "Each property gets a rating from 0.5 to 5.5. A share between two star limits gets a rating between them, on a straight line, so a share exactly at the 4-star limit rates 3.5. When a property has several bounds, its rating is the lowest of them.",
  "The sub-characteristic rating is the plain mean of the ratings of its properties. Rounded, that gives the stars.",
];

const SIZE_FAMILIES: SizeFamily[] = ["php", "python", "javascript", "typescript", "vue", "html", "css", "sql"];

function factorCell(factor: SizeFactor, format: (value: number) => string): string {
  const value = format(factor.value);
  return factor.proxyOf ? `${value} (${FAMILY_LABELS[factor.proxyOf]} proxy)` : value;
}

/** The factors of both size models per language family, from the constants the checker computes with. */
export const SIZE_FACTORS: FactorTable = {
  caption:
    "Factors per language. A proxy is the published factor of another language, used where the source publishes none.",
  columns: [
    "Language",
    "Lines per function point (QSM v5.0)",
    "Hours per function point (ISBSG)",
    "Lines per person-year (SIG v17.0)",
  ],
  rows: SIZE_FAMILIES.map((family) => [
    FAMILY_LABELS[family],
    factorCell(QSM_LINES_PER_FUNCTION_POINT[family], String),
    factorCell(ISBSG_HOURS_PER_FUNCTION_POINT[family], String),
    factorCell(SIG_V17_LINES_PER_PERSON_YEAR[family], formatCount),
  ]),
};

const SIZE_DOC: RatingAspectDoc = {
  id: "size",
  title: "Size",
  meaning:
    "How much production code the component has, and roughly how much work it would take to build it again. A larger system costs more to maintain and to take over. Size is shown for context: it is not better or worse in itself.",
  criteria: [{ checkId: "size", name: "Size", tool: "scc 4.1.0 on the production scope of the cloned repository" }],
  rating: [
    "scc counts lines of code: lines that are neither blank nor a comment. It counts the same production scope as the maintainability estimate: the tracked files, minus test code, minus generated, vendored and third-party code and database migrations (Sigrid's default excludes), minus the Nextcloud build output js/ and l10n/, and minus the exclude patterns of a sigrid.yaml at the repository root when there is one. Files scc recognises as minified or generated are left out as well. Besides PHP, JavaScript, TypeScript, Vue and Python, the size includes HTML and templates, style sheets and SQL.",
    `Rebuild effort, the open estimate, by backfiring: function points = the sum over the languages of lines ÷ lines per function point (QSM v5.0). Hours = the sum of function points × the median hours per function point (ISBSG). Person-years = hours ÷ ${formatCount(HOURS_PER_PERSON_YEAR)}, which is COCOMO II's 152 hours per person-month times 12. QSM has rows for JavaScript, HTML and SQL only, so PHP, Python, TypeScript and Vue use the JavaScript row and CSS uses the HTML row. ISBSG gives 7.6 hours for scripting languages, 13.7 for HTML, also used for CSS, and 11.4 for SQL. For a scripting language that works out to about 11,280 lines per person-year.`,
    "SIG-style volume, the estimate track: person-years = the sum over the languages of lines ÷ lines per person-year from the SIG/TÜV NORD guidance for producers v17.0, which lists the lines of code in 3.9 person-years: JavaScript 36,300, TypeScript 31,600 and Python 25,000. SIG published no factor for PHP, Vue, HTML, CSS or SQL. They use the JavaScript factor, and the report labels them as a proxy. With the Python factor instead, PHP lines would weigh 45% more.",
    "Neither figure is rated. SIG removed volume from the maintainability model in v18.0 (March 2026), and Sigrid still shows the person-years as context. The checker does the same: Size has weight 0 and no stars, and the SIG-style figure is labelled as context, not part of the 2026 rating. Under v17.0, 4 stars required 3.9 person-years or less. The SIG-style figure is a reproduction, not calibrated against SIG audits: SIG counts lines with its own parser and may detect languages differently. Backfiring usually lands 10 to 35% below it. COCOMO is not used, because it models a new project with its overhead and comes out 2.5 to 4 times higher.",
  ],
  counted: false,
  factors: SIZE_FACTORS,
  sources: [
    SOURCES.scc,
    SOURCES.sigridDefaultExcludes,
    SOURCES.qsmLanguages,
    SOURCES.isbsgDeliveryRate,
    SOURCES.maintainabilityGuidanceV17,
    SOURCES.sigrid2026Model,
    SOURCES.heitlager,
  ],
};

const MAINTAINABILITY_SOURCES: DocSource[] = [
  SOURCES.iso25010,
  SOURCES.qualityModels,
  SOURCES.maintainabilityCriteria,
  SOURCES.maintainabilityGuidance,
  SOURCES.heitlager,
  SOURCES.heitlagerPdf,
  SOURCES.benchmark,
  SOURCES.maintainabilityBands,
];

function subcharacteristic(
  id: string,
  title: string,
  meaning: string,
  properties: CodePropertyId[]
): RatingAspectDoc {
  return {
    id,
    title,
    meaning,
    criteria: [MAINTAINABILITY_CRITERION],
    rating: SUBCHARACTERISTIC_RATING,
    properties,
    counted: true,
    sources: MAINTAINABILITY_SOURCES,
  };
}

const OPEN_SOURCE_HEALTH_CRITERION: MeasuredCriterion = {
  checkId: "opensourcehealth",
  name: "Open Source Health",
  tool: "a vendored analysis script that reads the lockfiles and queries OSV.dev, Packagist, the npm registry and PyPI",
};

const OPEN_SOURCE_HEALTH_SCOPE =
  "The Open Source Health check reads the production dependencies from composer.lock, package-lock.json and requirements.txt at the repository root. Development dependencies are left out.";

const OPEN_SOURCE_HEALTH_SHARE_RATING =
  "Each bound gets a rating from 0.5 to 5.5 on a straight line between its star limits, like the maintainability properties: no dependency above the bound rates 5.5, a share exactly at the 4-star limit rates 3.5, and a share between two limits rates between them. The property's rating is the lowest of its bounds.";

const OPEN_SOURCE_HEALTH_COUNT_RATING =
  "None at all rates 5.5. Within a star level the rating falls on a straight line with the count, down to the bottom of the level at the most it allows, so more findings never raise it. A level that allows any number rates the middle of its band. The property's rating is the lowest of its classes.";

const OPEN_SOURCE_HEALTH_DERIVED =
  "The guidance publishes only the 4-star limits. The 5, 3 and 2-star limits are derived by the checker: 5 stars halves each share limit, 3 stars doubles it and 2 stars multiplies it by four.";

function healthProperty(id: string, title: string, meaning: string, rating: string[], extraSources: DocSource[] = []): RatingAspectDoc {
  return {
    id,
    title,
    meaning,
    criteria: [OPEN_SOURCE_HEALTH_CRITERION],
    rating: [OPEN_SOURCE_HEALTH_SCOPE, ...rating],
    counted: true,
    sources: [SOURCES.openSourceHealth, SOURCES.qualityModels, ...extraSources],
  };
}

const STATUS_RATING =
  "These criteria have no scale of their own, so a pass rates 5.5, a warning 3 and a fail 0.5, the ends and the middle of the scale. The aspect rating is the weighted mean of its criteria.";

const DOCUMENT_RATING =
  "This is a document aspect. Its rating is the share of the documents that were found: all of them rates 5.5, at least 80% rates 4, at least 60% 3, at least 40% 2, and less 1.";

/** The rating scale, explained once on the guide's index. */
export const RATING_SCALE = {
  text: "Every rating runs from 0.5 to 5.5, the scale of the quality models the checker follows: technically, their metrics range from 0.5 to 5.5 stars. Each star level is a band one wide. 4.5 to 5.5 is 5 stars, 3.5 to 4.5 is 4 stars, and so on down to 0.5 to 1.5 for 1 star, so a perfect result rates 5.5.",
  source: SOURCES.benchmark,
};

const AI_READINESS_RATING =
  "The rating is 0.5 plus the points found, at most 5.5. 4 or more passes, 2 or more is a warning, less fails. The category is informative: it never counts in the overall rating or the verdict.";

/** The AI readiness category: informative, rated but never counted in the overall rating. */
export const AI_READINESS_DOC: RatingCategoryDoc = {
  slug: "ai-readiness",
  title: "AI readiness",
  summary:
    "AI readiness shows how easily a coding agent can start work on the repository. Agents need written instructions, specifications, recorded decisions and an environment they can run. The checker reads the tree and a few root files of the scanned commit. The category has its own rating. It is informative: it never counts in the overall rating, Suitable for Common Ground, Maintained or the drop alerts.",
  aspects: [
    {
      id: "agent-instructions",
      title: "Instructions",
      meaning:
        "Whether the repository tells a coding agent how it is built, tested and organised, in AGENTS.md, CLAUDE.md, a Copilot or a Cursor instruction file.",
      criteria: [{ checkId: "agentinstructions", name: "Agent instructions", tool: "a search of the tree and the contents of root instruction files" }],
      rating: [
        "1 point for an instruction file, 1 more from 1,000 characters, 1 more from 4,000 characters, and 2 when it names a build, test or lint command.",
        AI_READINESS_RATING,
      ],
      counted: true,
      sources: [SOURCES.agentsMd],
    },
    {
      id: "specifications-and-decisions",
      title: "Specifications and decisions",
      meaning:
        "Whether an agent can read what the code must do and why it is built this way: specifications in OpenSpec, Spec Kit or Kiro layout, and numbered architecture decision records.",
      criteria: [
        { checkId: "specifications", name: "Specifications", tool: "a count of spec files in openspec/specs, specs/ or .kiro/specs" },
        { checkId: "architecturedecisions", name: "Architecture decision records", tool: "a count of numbered files in an ADR directory" },
      ],
      rating: [
        "Specifications: 1 rates 2, 5 rate 3, 10 rate 4 and 25 rate 5. Changes under openspec/changes add 0.5.",
        "Decision records: 1 rates 2, 3 rate 3, 5 rate 4 and 10 rate 5.5.",
        "The aspect rating is the mean of the two.",
      ],
      counted: true,
      sources: [SOURCES.openSpec, SOURCES.specKit, SOURCES.adr],
    },
    {
      id: "runnable-environment",
      title: "Runnable environment",
      meaning:
        "Whether an agent can start the component and check its own change: a dev container or Docker Compose file, and one command each to test, lint and build.",
      criteria: [
        {
          checkId: "devenvironment",
          name: "Runnable development environment",
          tool: "the tree and the scripts in package.json, composer.json, Makefile, justfile, Taskfile, pyproject.toml, tox.ini and noxfile.py",
        },
      ],
      rating: [
        "2 points for a dev container or Docker Compose file, and 1 point each for a test, a lint and a build command. Maven, Gradle, Go and Cargo projects give test and build by convention.",
        AI_READINESS_RATING,
      ],
      counted: true,
      sources: [SOURCES.devContainers],
    },
    {
      id: "interfaces-and-tooling",
      title: "Interfaces and tooling",
      meaning:
        "Whether an agent can read the interfaces instead of guessing them, and reuse the team's own steps: OpenAPI documents, llms.txt, an MCP configuration, skills, prompts and local quality gates.",
      criteria: [
        { checkId: "machineinterfaces", name: "Machine-readable interfaces", tool: "a search of the tree for OpenAPI documents, llms.txt and MCP configuration" },
        { checkId: "agenttooling", name: "Agent tooling", tool: "a search of the tree for skills, prompts, commands, pre-commit hooks and gate scripts" },
      ],
      rating: [
        "Interfaces: 3 points for an OpenAPI document, 1 for llms.txt and 1 for an MCP configuration.",
        "Tooling: 1 to 2 skills, prompts or commands give 1 point, 3 give 2 and 10 give 3; a local quality gate gives 2.",
        AI_READINESS_RATING,
      ],
      counted: true,
      sources: [SOURCES.openApi, SOURCES.llmsTxt, SOURCES.mcp],
    },
  ],
};

/** The rating model per category, in the order the guide lists them. */
export const RATING_DOCS: RatingCategoryDoc[] = [
  {
    slug: "security",
    title: "Security",
    summary:
      "Security covers the risks a component brings in through its dependencies, its own code and the way it is built and published. Most of the aspects come from the Open Source Health model, which rates the third-party dependencies.",
    aspects: [
      healthProperty(
        "vulnerabilities",
        "Vulnerabilities",
        "Known security vulnerabilities in the versions of the dependencies the component uses. A vulnerable dependency can make the whole component vulnerable.",
        [
          "Each locked version is looked up in the OSV.dev vulnerability database. The worst known severity per dependency counts.",
          "5 stars: no vulnerability of moderate severity or higher. 4 stars: nothing above moderate. 3 stars: at most 2 dependencies with a high or critical vulnerability. 2 stars: at most 5. More gives 1 star. Only the 4-star level is published; the others are derived by the checker.",
          `${OPEN_SOURCE_HEALTH_COUNT_RATING} One dependency with a high or critical vulnerability rates 3.0, two rate 2.5 and five 1.5; a moderate one rates 4.0.`,
        ],
        [SOURCES.osv, SOURCES.osvApi]
      ),
      healthProperty(
        "dependency-freshness",
        "Dependency freshness",
        "How far the versions in use are behind the latest release of each dependency. Old versions miss fixes and make upgrades harder later.",
        [
          "For each dependency the check compares the release date of the version in use with the latest release, using the package registries.",
          "4 stars: at most 34.2% of the dependencies more than 1 year behind, at most 19.1% more than 2 years, at most 11.1% more than 3.5 years, and none more than 5 years. A dependency more than 5 years behind caps the rating at 3 stars.",
          `${OPEN_SOURCE_HEALTH_SHARE_RATING} A dependency more than 5 years behind caps it at 3.49, the top of 3 stars.`,
          OPEN_SOURCE_HEALTH_DERIVED,
        ]
      ),
      healthProperty(
        "dependency-activity",
        "Dependency activity",
        "Whether the dependencies are still maintained. A dependency that has not released anything for years may no longer get security fixes.",
        [
          "For each dependency the check takes the date of its latest release from the package registry.",
          "4 stars: at most 21.4% of the dependencies with no release for more than 1 year, at most 13.0% for more than 2 years, at most 9.6% for more than 4 years, and none for more than 5.5 years. A dependency without a release for more than 5.5 years caps the rating at 3 stars.",
          `${OPEN_SOURCE_HEALTH_SHARE_RATING} A dependency without a release for more than 5.5 years caps it at 3.49, the top of 3 stars.`,
          OPEN_SOURCE_HEALTH_DERIVED,
        ]
      ),
      healthProperty(
        "dependency-licences",
        "Dependency licences",
        "The legal risk of the licences of the dependencies. Some licences put conditions on how the component may be used or distributed.",
        [
          "The check reads each dependency's licence from the lockfile or the registry and puts it in a risk class. AGPL is critical; non-commercial and share-alike Creative Commons licences are high; GPL, MPL and no-derivatives Creative Commons licences are medium; LGPL, CDDL and EPL are low. When a dependency offers a choice of licences, the lowest risk counts.",
          "5 stars: no risky licence. 4 stars: no critical, high or medium risk and at most 3 low. 3 stars: no critical or high risk. 2 stars: no critical risk. A critical risk gives 1 star.",
          `${OPEN_SOURCE_HEALTH_COUNT_RATING} One low-risk licence rates 4.17 and three 3.5; a medium risk rates 3.0, a high risk 2.0 and a critical risk 1.0.`,
        ],
        [SOURCES.spdxLicences]
      ),
      healthProperty(
        "dependency-management",
        "Dependency management",
        "Whether third-party code comes in through a package manager. Code copied into the repository by hand is easy to forget when it needs an update.",
        [
          "The check counts the third-party libraries committed into the repository, such as vendor or third_party directories and minified files, as a share of all dependencies.",
          "5 stars: none. 4 stars: at most 6%. 3 stars: at most 12%. 2 stars: at most 24%. More gives 1 star. Only the 4-star level is published; the others are derived by the checker.",
          "The rating runs on a straight line between those limits, like the maintainability properties: none rates 5.5, 6% rates 3.5 and 100% rates 0.5.",
        ]
      ),
      {
        id: "container-images",
        title: "Container images",
        meaning:
          "Known vulnerabilities in the container images a municipality runs when it installs the component's Helm chart. This covers the operating system packages and libraries inside the images, which the repository dependency scan does not see.",
        criteria: [
          {
            checkId: "artifacthub",
            name: "Helm chart on Artifact Hub, images scanned",
            tool: "the Trivy security report that Artifact Hub publishes for the chart",
          },
        ],
        rating: [
          "Only for container components: a component that publishes a container image, found by the Docker image criterion, or that has a Helm chart. A Dockerfile alone, for development or tests, does not count. For a Nextcloud app or a library the criterion does not apply: it counts in no score, rating or verdict, and the repository dependency scan stays the check that counts.",
          "The checker looks for the component's Helm package on Artifact Hub. A link to the package in the README or publiccode.yml counts first, then the repositoryID in artifacthub-repo.yml, then a package whose links point at the repository, then a package with the chart's name from the same owner. The result says how the package was matched.",
          "Artifact Hub scans the images of every chart version with Trivy. It takes the images from a dry run of the chart with its default values, or from the artifacthub.io/images annotation in Chart.yaml. The latest version is scanned again every day.",
          "Pass: the latest version has no critical vulnerabilities. The result shows the counts per severity per image, the date of the scan and the link to the package. Fail: no package on Artifact Hub, or at least one critical vulnerability.",
          "Not measured, shown as a warning and never as a pass: the version is older than one year, it uses more than 15 images, the images are private or excluded, the scanner is switched off, or there is no report yet. Artifact Hub skips images over 4 GiB without saying so; the checker names every image that is missing from the report.",
          "A pass rates 5.5, a warning 3 and a fail 0.5. The criterion is mandatory from 19 May 2027. Until then a fail is a warning and does not count against the verdict.",
        ],
        counted: true,
        sources: [SOURCES.artifactHubSecurity, SOURCES.artifactHubImages, SOURCES.trivy],
      },
      {
        id: "secrets",
        title: "Secrets",
        meaning:
          "Whether passwords, API keys, tokens or private keys are committed to the repository. A committed secret can be found and used by anyone who reads the code.",
        criteria: [{ checkId: "secretscanning", name: "No committed secrets", tool: "gitleaks 8.30.1" }],
        rating: [
          "gitleaks scans the files of the repository, honouring the project's own .gitleaks.toml and .gitleaksignore. Findings are reported by rule and location, never with the secret itself.",
          "No finding passes, a finding fails. When gitleaks cannot run, the criterion warns. A pass rates 5.5, a warning 3 and a fail 0.5.",
        ],
        counted: true,
        sources: [SOURCES.gitleaks, SOURCES.cwe798, SOURCES.owaspSecrets],
      },
      {
        id: "secure-coding",
        title: "Secure coding",
        meaning:
          "Whether the code avoids common insecure patterns, such as running dynamic code, injecting unescaped HTML, starting shell commands, unsafe deserialisation, weak hashing and switching off TLS verification.",
        criteria: [
          { checkId: "owaspsecurecoding", name: "OWASP Secure Coding", tool: "the checker's own pattern scan (a heuristic, not a full static analysis)" },
        ],
        rating: [
          "The check searches the source files for a fixed list of risky patterns. No finding passes, a few findings warn, and more findings than the threshold fail.",
          "A pass rates 5.5, a warning 3 and a fail 0.5. A heuristic finds likely problems, not proven ones, so a finding is a reason to look, not a verdict.",
        ],
        counted: true,
        sources: [SOURCES.owaspSecureCoding, SOURCES.owaspTop10],
      },
      {
        id: "supply-chain",
        title: "Supply chain",
        meaning:
          "How well the project protects the way its code is built and released, and whether it says what it contains. This is what a user relies on when installing a release.",
        criteria: [
          { checkId: "openssfscorecard", name: "OpenSSF Scorecard", tool: "the public OpenSSF Scorecard API (GitHub repositories only)" },
          { checkId: "sbom", name: "SBOM", tool: "a search of the repository for an SPDX or CycloneDX document" },
        ],
        rating: [
          "The OpenSSF Scorecard rates practices such as branch protection, code review, pinned dependencies and signed releases on a scale from 0 to 10. The checker maps the score to stars with its own bands: 9 or more is 5 stars, 7 or more is 4, 5 or more is 3, 3 or more is 2, and less is 1.",
          "The SBOM criterion passes when the repository holds a software bill of materials in SPDX or CycloneDX format, and rates 5.5 for a pass and 0.5 for a fail. It checks that the document is there, not what it lists.",
          "The aspect rating is the weighted mean of both criteria.",
        ],
        counted: true,
        sources: [SOURCES.scorecard, SOURCES.scorecardChecks, SOURCES.spdxSpecs, SOURCES.cyclonedx],
      },
    ],
  },
  {
    slug: "maintainability",
    title: "Maintainability",
    summary:
      "Maintainability is how easily a component can be understood, changed, tested and reused. ISO/IEC 25010 defines five sub-characteristics. The checker estimates each of them from properties of the source code, the way the published maintainability model does, adds an aspect for the tests, and shows the size of the code without rating it.",
    aspects: [
      subcharacteristic(
        "analysability",
        "Analysability",
        "How easily a developer can find out what the code does, find the cause of a fault or see where a change is needed.",
        ["duplication", "unit-size"]
      ),
      subcharacteristic(
        "modifiability",
        "Modifiability",
        "How easily the code can be changed without introducing faults or making it worse.",
        ["duplication", "unit-complexity", "module-coupling"]
      ),
      subcharacteristic(
        "testability",
        "Testability",
        "How easily tests can be written for the code and how well they can show that it works.",
        ["unit-complexity", "component-independence"]
      ),
      subcharacteristic(
        "modularity",
        "Modularity",
        "How well the code is split into parts that can be changed without affecting the other parts.",
        ["module-coupling", "component-independence", "component-entanglement"]
      ),
      subcharacteristic(
        "reusability",
        "Reusability",
        "How easily parts of the code can be used again, in this system or in another one.",
        ["unit-size", "unit-interfacing"]
      ),
      {
        id: "testing",
        title: "Testing",
        meaning:
          "Whether the component has automated tests and how much of the code they cover. Tests make it safe to change the code.",
        criteria: [
          { checkId: "tests", name: "Test suite", tool: "a search for test files and test configuration" },
          { checkId: "coverage", name: "Code coverage", tool: "a coverage report or coverage figure in the repository" },
          { checkId: "testcoderatio", name: "Test code ratio", tool: "a line count of test code against production code in the cloned repository" },
        ],
        rating: [
          "The test suite criterion passes when test files or test configuration are present. Code coverage passes at 80% line coverage or more. Both rate 5.5 for a pass, 3 for a warning and 0.5 for a fail.",
          "The test code ratio is test code lines as a percentage of production code lines. A ratio of 100% corresponds roughly to 80% coverage. 120% or more is 5 stars, 100% is 4, 75% is 3, 25% is 2, and less is 1.",
          "The aspect rating is the weighted mean of the three criteria.",
        ],
        counted: true,
        sources: [SOURCES.testCodeRatio, SOURCES.iso25010],
      },
      SIZE_DOC,
    ],
  },
  {
    slug: "governance",
    title: "Governance",
    summary:
      "Governance covers the legal and organisational side of a component: under which licence it may be used, who owns it, and how people can contribute and report problems.",
    aspects: [
      {
        id: "licensing",
        title: "Licensing",
        meaning:
          "Whether the component is open source under a recognised licence, preferably the EUPL, and whether every place that names the licence names the same one.",
        criteria: [
          { checkId: "license", name: "OSI-approved licence", tool: "detection of the LICENSE file text" },
          { checkId: "eupllicense", name: "EUPL licence", tool: "detection of the LICENSE file text" },
          { checkId: "licenceconsistency", name: "Licence consistency", tool: "a comparison of LICENSE, package manifests and publiccode.yml, normalised to SPDX" },
          { checkId: "spdxheaders", name: "SPDX licence headers", tool: "a scan of the source files for SPDX-License-Identifier and REUSE files" },
        ],
        rating: [
          "The licence, EUPL and licence consistency criteria rate 5.5 for a pass, 3 for a warning and 0.5 for a fail. Licence consistency warns when only one declaration is found or when declarations differ only in -only or -or-later.",
          "SPDX licence headers has its own scale: the share of source files with a licence header, or covered by REUSE.toml, .reuse/dep5 or a .license file. 100% is 5 stars, 95% is 4, 80% is 3, 50% is 2, and less is 1.",
          "The aspect rating is the weighted mean of the four criteria.",
        ],
        counted: true,
        sources: [
          SOURCES.osiLicences,
          SOURCES.eupl,
          SOURCES.spdxLicences,
          SOURCES.spdxIdentifiers,
          SOURCES.reuse,
          SOURCES.publicCodeLicence,
        ],
      },
      {
        id: "ownership",
        title: "Ownership",
        meaning:
          "Whether it is clear who owns the component and who is responsible for it. A buyer needs to know whom to talk to and who holds the rights.",
        criteria: [
          { checkId: "copyrightowner", name: "Copyright owner", tool: "the legal files and repository metadata" },
          { checkId: "publiccode", name: "publiccode.yml", tool: "the publiccode.yml file in the repository root and its required fields" },
        ],
        rating: [STATUS_RATING],
        counted: true,
        sources: [SOURCES.legalGuide, SOURCES.publiccodeYml, SOURCES.publicCodeFindable],
      },
      {
        id: "maintenance",
        title: "Maintenance",
        meaning:
          "Whether the component has a valid maintenance contract: a buyer needs to know who fixes bugs and security issues, and until when. publiccode.yml declares the contractors and the end date of their contract.",
        criteria: [
          {
            checkId: "maintenance",
            name: "Maintenance contract",
            tool: "the maintenance section of publiccode.yml: passes only on a contract with a named contractor whose end date has not passed, and says what is missing or invalid otherwise",
          },
        ],
        rating: [STATUS_RATING],
        counted: true,
        sources: [SOURCES.publiccodeMaintenance],
      },
      {
        id: "community-documents",
        title: "Community documents",
        meaning:
          "Whether the project has the documents that let other people use it and take part: documentation, a contributing guide, a code of conduct, a security policy and a changelog.",
        criteria: [
          { checkId: "documentation", name: "README and documentation", tool: "a search for a README, a docs folder or a documentation link" },
          { checkId: "contributing", name: "CONTRIBUTING", tool: "a search for the file" },
          { checkId: "codeofconduct", name: "CODE_OF_CONDUCT", tool: "a search for the file" },
          { checkId: "security", name: "SECURITY", tool: "a search for the file" },
          { checkId: "changelog", name: "CHANGELOG", tool: "a search for a changelog or release notes file" },
        ],
        rating: [DOCUMENT_RATING],
        counted: true,
        sources: [
          SOURCES.publicCodeDocument,
          SOURCES.publicCodeContributing,
          SOURCES.contributingGuide,
          SOURCES.codeOfConduct,
          SOURCES.securityPolicy,
          SOURCES.changelog,
        ],
      },
      {
        id: "usage-and-ecosystem",
        title: "Usage and ecosystem",
        meaning:
          "Who uses the component and how much, as far as public sources tell. It helps a buyer see whether others already run the component and whether there is a community around it.",
        criteria: [
          {
            checkId: "usage",
            name: "Declared users",
            tool: "the usedBy list of publiccode.yml: self-declared by the maintainers and not verified. The publiccode.yml standard has deprecated the key, but files may still declare it",
          },
          {
            checkId: "usage",
            name: "Nextcloud App Store",
            tool: "the App Store catalogue, for the app id in appinfo/info.xml: the number of ratings given. The App Store publishes no download count",
          },
          {
            checkId: "usage",
            name: "GitHub releases",
            tool: "the download count of the release files, which includes App Store installs and updates, CI jobs and mirrors",
          },
          {
            checkId: "usage",
            name: "npm, Packagist and PyPI",
            tool: "the downloads of the package named in package.json, composer.json or pyproject.toml, setup.cfg or setup.py, only when the registry says it is published from this repository. Downloads include CI builds and mirrors",
          },
          {
            checkId: "usage",
            name: "Docker Hub and GitHub Container Registry",
            tool: "the pull count of the images given with the check or named in the README under the repository's owner or name. Pulls include CI pulls and automatic updates. GitHub publishes no pull count for its registry, so that row says not measured",
          },
          {
            checkId: "usage",
            name: "deps.dev",
            tool: "the number of npm or PyPI packages that depend on the package's default version",
          },
          {
            checkId: "usage",
            name: "GitHub repository and contributors",
            tool: "stars, forks and watchers, and the authors of the commits of the last 12 months, after the repository's .mailmap. An author's organisation is the domain of their email address; for a personal, hidden or noreply address it is the company on their public GitHub profile, looked up while counting (at most 200 profiles per scan, set with CGC_PROFILE_LOOKUP_LIMIT; the rest stay unknown and the row says how many). Authors count as from the owning organisation (the most common organisation domain, the domains and names in publiccode.yml, and the owner account and its name), from other organisations, or unknown. When the organisation of more than half is unknown, the row only says so. Only counts are kept: no names, logins, addresses, companies or domains of one person; an organisation is named only when at least two authors share it",
          },
        ],
        rating: [
          "This aspect is never rated and never given stars. Each source is shown on its own with the date it was measured and a one-line caveat, and the figures are not added up.",
          "It is not rated because the figures do not measure quality and cannot be compared fairly: a library used by thousands of packages and a case system run by twenty municipalities serve different markets, downloads count CI jobs and mirrors, a register lists what is declared rather than what runs, and many government installations are not visible to any public source at all.",
          "A source that knows nothing about the component is left out; a source that applies but does not answer in time says not measured, with the reason. When no source has anything, the aspect is not shown.",
          "The Open Source Register of developer.overheid.nl records which organisation manages a repository, not who uses it, so it is not one of the sources.",
        ],
        counted: false,
        informative: true,
        sources: [
          SOURCES.publiccodeUsedBy,
          SOURCES.nextcloudAppStoreApi,
          SOURCES.githubReleaseAssets,
          SOURCES.npmDownloads,
          SOURCES.packagistApi,
          SOURCES.pypistats,
          SOURCES.dockerHubApi,
          SOURCES.depsDevApi,
          SOURCES.githubContributors,
          SOURCES.ossRegister,
        ],
      },
      {
        id: "project-health",
        title: "Project health",
        meaning:
          "Whether the project is alive and carried by more than one person or organisation: who makes the changes, how quickly contributions and questions get an answer, and how often a release comes out. A component that a municipality depends on should not stop when one person leaves.",
        criteria: [
          {
            checkId: "projecthealth",
            name: "Project health (CHAOSS)",
            tool: "the GitHub or GitLab REST API the checker already uses, read with the GITHUB_TOKEN or GITLAB_TOKEN when one is set",
          },
        ],
        rating: [
          "This aspect is informative. It shows six metrics from the CHAOSS project, each with its value and what it means, but it gives no stars and does not count in the Governance rating. Activity says something about risk, not about quality, and the values depend on how a project works: a project that merges through one maintainer is not worse by definition.",
          "Contributor Absence Factor (bus factor): the fewest people who together made half of the commits of the last 12 months on the default branch. Bots are left out. Read 1 as a warning that the project depends on one person; 3 or more is a project that survives a departure.",
          "Organizational Diversity: the share of recent commits (up to the latest 300 on GitHub and 500 on GitLab) per organisation, after the repository's .mailmap. The organisation is the email domain; for a personal, hidden or noreply address, such as gmail.com or GitHub's noreply addresses, it is the company on the author's public GitHub profile, looked up while counting (at most 200 profiles per scan, set with CGC_PROFILE_LOOKUP_LIMIT; GitLab does not say which account made a commit, so there these stay unknown). A company that names the owner counts as the owner's domain. Authors whose organisation stays unknown are counted apart, and when that is more than half of them the metric says not measured. Read one organisation with nearly all commits as a single-supplier project.",
          "Change Request Closure Ratio: the pull or merge requests closed (merged or not) in the last 90 days divided by those opened, bots included. Around 1 the backlog is stable; well below 1 it grows.",
          "Time to First Response and Issue Response Time: the median time to the first comment (on a pull or merge request also a review) by someone other than the author, over the 15 latest pull or merge requests and the 15 latest issues opened by people between 90 and 7 days ago. The week's margin gives every item time to get an answer. Items without an answer are counted apart. A few days is normal for a volunteer project; no response at all means contributions or questions go unheard, or that one person works alone.",
          "Release Frequency: the final releases published in the last 12 months, from GitHub or GitLab releases. Pre-releases and drafts are left out and counted apart. When a GitHub repository has no releases, its version tags (such as 1.2.3) are dated through one GraphQL call, which needs a GITHUB_TOKEN.",
          "A metric the API gives no data for says \"not measured\" with the reason, for example a switched-off issue tracker, or a missing token for the calls per sampled item.",
          "No personal data is stored. Logins, email addresses and profile companies are used only while counting; the result holds counts, dates and durations. A domain or company is named only when at least two authors share it, so it names an organisation and not a person.",
        ],
        counted: false,
        sources: [
          SOURCES.chaossMetrics,
          SOURCES.chaossAbsenceFactor,
          SOURCES.chaossOrganizationalDiversity,
          SOURCES.chaossClosureRatio,
          SOURCES.chaossFirstResponse,
          SOURCES.chaossIssueResponse,
          SOURCES.chaossReleaseFrequency,
        ],
      },
    ],
  },
  {
    slug: "deployment-operations",
    title: "Deployment & Operations",
    summary:
      "Deployment and operations covers how a component gets to run in production: as a container, on Kubernetes, and through a build and release process that others can follow.",
    aspects: [
      {
        id: "containerisation",
        title: "Containerisation",
        meaning:
          "Whether the component can run as a container on a standard platform such as Haven: it can be built from a Dockerfile and started with Compose, a ready image is published, and a Helm chart deploys it to Kubernetes.",
        criteria: [
          { checkId: "docker", name: "Dockerfile and Compose file", tool: "a search for a Dockerfile and a Compose file under any of its standard names" },
          { checkId: "dockerimage", name: "Published image", tool: "an image location declared by the repository or given with the check" },
          { checkId: "helmchart", name: "Helm chart", tool: "a search for Chart.yaml, in the repository or in a chart repository it points to" },
        ],
        rating: [DOCUMENT_RATING],
        counted: true,
        sources: [SOURCES.dockerfile, SOURCES.composeModel, SOURCES.helmCharts, SOURCES.haven],
      },
      {
        id: "release-management",
        title: "Release management",
        meaning:
          "Whether the component is built and tested automatically and released with version numbers that say what kind of change a release contains.",
        criteria: [
          { checkId: "cicd", name: "CI/CD configuration", tool: "a search for workflow or pipeline configuration" },
          { checkId: "semver", name: "Semantic versioning", tool: "the releases and tags of the repository" },
        ],
        rating: [STATUS_RATING],
        counted: true,
        sources: [SOURCES.githubActions, SOURCES.publicCodeCi, SOURCES.semver],
      },
    ],
  },
  {
    slug: "architecture",
    title: "Architecture",
    summary:
      "Architecture covers how the component fits into the Common Ground landscape: through standard APIs, and in one of the layers of the five-layer model.",
    aspects: [
      {
        id: "api",
        title: "API",
        meaning:
          "Whether the component offers its functions through a documented API that follows the Dutch government's API Design Rules, so other components can use it in a standard way.",
        criteria: [
          { checkId: "openapi", name: "OpenAPI specification", tool: "a search for an OpenAPI or Swagger document" },
          { checkId: "adrvalidator", name: "NL API Design Rules", tool: "Spectral with the API Design Rules rule set" },
        ],
        rating: [
          "The OpenAPI criterion passes when a machine-readable specification is found. The API Design Rules criterion validates that specification with Spectral against the API Design Rules rule set.",
          STATUS_RATING,
        ],
        counted: true,
        sources: [SOURCES.openApi, SOURCES.apiDesignRules, SOURCES.apiDesignRulesRepo, SOURCES.spectral],
      },
      {
        id: "layering",
        title: "Layering",
        meaning:
          "Which layer of the Common Ground five-layer model the component belongs to: interaction, process, integration, service or data.",
        criteria: [{ checkId: "fivelayer", name: "5-layer architecture", tool: "signals in paths, file names and the README" }],
        rating: [
          "The check reports the layer or layers it recognises. The result is shown, but it does not count in the Architecture rating, because belonging to one layer or another is not better or worse.",
        ],
        counted: false,
        sources: [SOURCES.fiveLayerModel],
      },
      {
        id: "standards",
        title: "Standards",
        meaning:
          "Which Dutch government standards the component supports, and in which version, such as the ZGW APIs or the NL API Design Rules. A component declares them in publiccode.yml under supports, as the Common Ground profile for publiccode.yml describes.",
        criteria: [
          {
            checkId: "standards",
            name: "Supported standards",
            tool: "publiccode.yml supports, compared with the OpenAPI files by their info.title or their top-level resources, and their info.version",
          },
        ],
        rating: [
          "The check lists the declared standards and versions, and names an entry that is not in its registry of known standards. It compares them with the OpenAPI files in the repository: declared and found, declared but not found, and found but not declared.",
          "The result is informative. It has no stars and does not count in the Architecture rating or in the verdict.",
        ],
        counted: false,
        sources: [SOURCES.publiccodeSupports, SOURCES.apiDesignRules],
      },
    ],
  },
  AI_READINESS_DOC,
];

/** Every source linked from the guide, without duplicates. */
export const ALL_SOURCES: DocSource[] = Object.values(SOURCES);

export function findCategoryDoc(slug: string): RatingCategoryDoc | undefined {
  return RATING_DOCS.find((category) => category.slug === slug);
}

export function codeProperty(id: CodePropertyId): CodePropertyDoc {
  const property = CODE_PROPERTIES.find((candidate) => candidate.id === id);
  if (!property) throw new Error(`Unknown code property ${id}`);
  return property;
}

/** Path of an aspect in the guide, for links from other pages. */
export function aspectDocHref(categorySlug: string, aspectId: string): string {
  return `/docs/${categorySlug}#${aspectId}`;
}
