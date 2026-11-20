import { ASPECT_MODEL, resolveCategory } from "./aspects";
import {
  CRITERION_VERSIONS,
  RESULT_CATEGORY_BY_ID,
  RESULT_ORDER_BY_ID,
  criterionDocHref,
  type CriteriaCategory,
} from "./criteria";
import { RATING_DOCS, aspectDocHref } from "./ratingDocs";
import { PROFILE_FIELDS, PUBLICCODE_PROFILE_PATH } from "./publiccodeProfile";
import type { SfpcCriterionId } from "./standardForPublicCode";
import type { RequirementLevel } from "./types";

/** Path of the criteria index in the rating guide. */
export const CRITERIA_DOC_HREF = "/docs/criteria";

/**
 * Where a criterion comes from. The checklist rests on three sources and adds
 * no conditions of its own; "information" marks context that never counts, and
 * "agents" the informative AI readiness criteria.
 */
export type CriterionSource = "checklist" | "sig" | "alv" | "information" | "agents";

export const SOURCE_ORDER: CriterionSource[] = ["checklist", "sig", "alv", "information", "agents"];

export const SOURCE_DOCS: Record<CriterionSource, { label: string; explanation: string }> = {
  checklist: {
    label: "Hugo ter Doest's proposal",
    explanation:
      "Hugo ter Doest's proposal for the Component Checker sets what a repository must contain: a licence, publiccode.yml, documentation, tests, Docker, Helm, OpenAPI and the other basics.",
  },
  sig: {
    label: "SIG ratings as Common Ground uses them",
    explanation:
      "The Common Ground programme asks that a component is ready for certification by SIG and TÜViT. The checker estimates these ratings with open tools. It does not certify: certification is a manual assessment by SIG and TÜViT.",
  },
  alv: {
    label: "Common Ground standard v1.0",
    explanation:
      "The Common Ground standard v1.0 is the standard VNG puts to its general assembly (ALV) of 11 December 2026. It asks that a component meets the agreed standards and is proven in use by one or more municipalities.",
  },
  agents: {
    label: "AI readiness",
    explanation:
      "How easily a coding agent can start work on the repository, based on the conventions teams that work with agents use: AGENTS.md, specifications, decision records, a runnable environment and agent tooling. These criteria have their own rating but never count in the overall rating or the verdict.",
  },
  information: {
    label: "Information only",
    explanation:
      "Context shown next to the rating. It adds no condition, has no stars of its own and never counts in the score or the verdict.",
  },
};

export const LEVEL_LABELS: Record<RequirementLevel, string> = {
  mandatory: "Mandatory",
  recommended: "Recommended",
  informative: "Informative",
};

/** Category, aspect and level of a criterion that this version of the checker does not measure yet. */
export interface PlannedCriterion {
  /** The category as the aspect model names it, resolved with resolveCategory() */
  category: string;
  /** Aspect id in the aspect model, when the criterion feeds one */
  aspect?: string;
  level: RequirementLevel;
}

export interface CriterionDoc {
  id: string;
  title: string;
  source: CriterionSource;
  /** Other sources the criterion also follows from, next to its main source */
  alsoFrom?: CriterionSource[];
  /** The criterion of the Standard for Public Code that this criterion measures a part of */
  standardForPublicCode?: SfpcCriterionId;
  /** How the criterion follows from its source, when that is not obvious */
  sourceNote?: string;
  /** What the checker looks at */
  what: string;
  /** Why it matters for a municipality that wants to reuse the component */
  why: string;
  /** The tool, for a criterion the rating guide does not name a tool for */
  tool?: string;
  /** How the components are defined, for a criterion that measures components */
  components?: string;
  /** Steps that make the criterion pass */
  howToPass: string[];
  /** Ids of the publiccode.yml profile fields the criterion reads */
  publiccodeFields?: string[];
  /** Set only for a criterion that lives in an open change, not in this version */
  planned?: PlannedCriterion;
}

/** How maintainability and coupling define components; both use the same definition. */
const COMPONENTS_DOC =
  "Components are the ones the repository declares: the components: block of the analysis scope file (sigrid.yaml), else the components: block of sigrid.components.yaml, else the scope file's component_base_dirs or component_depth. Without a declaration they are directories. Maintainability and coupling always use the same definition. When the repository declares components, the result also shows the figures with directory components and says that the declared ones are used. An app that lists its functional areas bottom to top in tools/sig/area-order.json also gets a count of the file references that go against that order, with the files most of them start in; a contract under lib/Kernel/Contracts/<Area>/ belongs to that area. That count is informative and changes no rating.";

export const CRITERION_DOCS: CriterionDoc[] = [
  {
    id: "sourcecode",
    title: "Actual source code",
    source: "checklist",
    standardForPublicCode: "code-in-the-open",
    what: "The repository holds source code files, not only documentation, configuration or templates.",
    why: "A municipality can only reuse, audit or fork what is actually published. A repository with only a README promises code it does not contain.",
    tool: "a search of the repository tree for files in a programming language",
    howToPass: [
      "Publish the source code of the component in this repository.",
      "If the code lives in another repository, check that repository instead.",
    ],
  },
  {
    id: "fivelayer",
    title: "Common Ground 5-layer architecture",
    source: "checklist",
    what: "Which layer of the five-layer model the component belongs to: interaction, process, integration, service or data.",
    why: "The layer tells an architect where the component fits and which other components it should talk to. The Common Ground standard v1.0 also groups its basisset by layer.",
    howToPass: [
      "Declare one layer in publiccode.yml as a supports entry, as the Common Ground profile describes.",
      "Declare one layer only. Two or more layers give a warning.",
      "Without a declaration, the checker guesses from the README, the topics and the paths, and warns.",
    ],
    publiccodeFields: ["layer"],
  },
  {
    id: "license",
    title: "Open source licence (OSI-approved)",
    source: "checklist",
    standardForPublicCode: "publish-with-an-open-license",
    what: "The repository has a LICENSE file with a licence the Open Source Initiative approves.",
    why: "Without an open licence, nobody else may legally use, change or share the code.",
    howToPass: [
      "Add a LICENSE file in the root with the full text of an OSI-approved licence.",
      "Use the standard licence text, so the checker recognises it.",
    ],
    publiccodeFields: ["licence"],
  },
  {
    id: "eupllicense",
    title: "EUPL licence",
    source: "checklist",
    standardForPublicCode: "publish-with-an-open-license",
    what: "The licence is the European Union Public Licence (EUPL).",
    why: "The EUPL is written for public sector software and is valid in every EU language and legal system. Dutch government policy prefers it.",
    howToPass: ["Publish the component under EUPL-1.2.", "Another OSI-approved licence gives a warning, not a fail."],
    publiccodeFields: ["licence"],
  },
  {
    id: "licenceconsistency",
    title: "Licence consistency",
    source: "checklist",
    sourceNote: "A closer measurement of the licence criterion: registers and app stores read the manifests, not the LICENSE file.",
    what: "Every place that declares the licence names the same one: LICENSE, package manifests, publiccode.yml and a Nextcloud appinfo/info.xml.",
    why: "Registers and app stores read the licence from the manifests. When those disagree with the LICENSE file, a buyer cannot tell which licence applies.",
    howToPass: [
      "Name the same licence everywhere, as an SPDX identifier such as EUPL-1.2.",
      "Update package.json, composer.json and publiccode.yml when the licence changes.",
    ],
    publiccodeFields: ["licence"],
  },
  {
    id: "copyrightowner",
    title: "Copyright owner",
    source: "checklist",
    what: "The legal files and repository metadata name who owns the copyright.",
    why: "Only the owner can relicense or sign an agreement about the code. A buyer needs to know who that is.",
    howToPass: [
      "Name the copyright owner in the LICENSE file, a COPYRIGHT or NOTICE file, or the file headers.",
      "Fill legal.mainCopyrightOwner in publiccode.yml.",
    ],
    publiccodeFields: ["licence"],
  },
  {
    id: "spdxheaders",
    title: "SPDX licence headers",
    source: "checklist",
    standardForPublicCode: "publish-with-an-open-license",
    sourceNote: "A closer measurement of the licence criterion, as the REUSE specification and the Standard for Public Code ask.",
    what: "The share of source files that carry an SPDX-License-Identifier header, or are covered by REUSE.toml, .reuse/dep5 or a .license file.",
    why: "Municipalities reuse code per file. The file itself then has to say under which licence that is allowed.",
    howToPass: [
      "Add an SPDX-License-Identifier line to the top of every source file.",
      "Cover generated or binary files with REUSE.toml.",
      "100% gives five stars, 95% four, 80% three and 50% two. These bands are the checker's own.",
    ],
  },
  {
    id: "publiccode",
    title: "publiccode.yml",
    source: "checklist",
    standardForPublicCode: "make-the-codebase-findable",
    what: "A publiccode.yml file in the root of the repository, with the fields the standard requires.",
    why: "Catalogues such as developer.overheid.nl read publiccode.yml to list the component. Without it, nobody finds it.",
    howToPass: [
      "Add publiccode.yml to the root of the repository.",
      "Fill publiccodeYmlVersion, name, url and legal. The checker warns when one is missing.",
      "Follow the Common Ground profile for the other fields.",
    ],
    publiccodeFields: ["file", "publiccode-yml-version"],
  },
  {
    id: "maintenance",
    title: "Maintenance contract",
    source: "alv",
    sourceNote:
      "Suitable for Common Ground, the threshold the programme uses to adopt a component as supported, requires a valid maintenance contract. The ALV papers have municipalities contract on VNG model contracts.",
    what: "publiccode.yml names a contractor whose maintenance contract has not ended.",
    why: "A municipality that adopts a component needs someone who fixes it. A contract with an end date in the future shows that someone is.",
    howToPass: [
      "Set maintenance.type to contract.",
      "Name each contractor with name and until. until is the end date of the contract, as YYYY-MM-DD, in the future.",
      "The types internal, community and none mean there is no contract, so the criterion fails.",
    ],
    publiccodeFields: ["maintenance"],
  },
  {
    id: "usage",
    title: "Usage and ecosystem",
    source: "information",
    alsoFrom: ["alv"],
    sourceNote:
      "Context for the verdict: Suitable for Common Ground asks at least 2 organisations in usedBy, so the component is proven in use.",
    what: "Who uses the component and how much, per source: users in publiccode.yml, App Store and package downloads, container pulls and dependent projects.",
    why: "Use by other organisations shows the component works in practice. The figures are not compared across components, because each source counts differently.",
    tool: "publiccode.yml usedBy and the public APIs of npm, Packagist, PyPI, the Nextcloud App Store, GitHub releases and the container registries",
    howToPass: [
      "There is nothing to pass: the criterion is informative.",
      "Name the organisations that use the component in usedBy in publiccode.yml.",
    ],
    publiccodeFields: ["used-by"],
  },
  {
    id: "docker",
    title: "Docker support",
    source: "checklist",
    standardForPublicCode: "make-the-codebase-reusable-and-portable",
    what: "A Dockerfile and a Compose file in the repository.",
    why: "Common Ground components run as containers on Haven. A Dockerfile lets anyone build the image, and a Compose file lets them start it locally.",
    howToPass: [
      "Add a Dockerfile that builds the component.",
      "Add a docker-compose.yml or compose.yaml that starts it with its dependencies.",
    ],
  },
  {
    id: "dockerimage",
    title: "Available Docker image",
    source: "checklist",
    what: "A published container image that deployments can pull.",
    why: "A ready image lets a municipality deploy a tested release without building it themselves.",
    howToPass: [
      "Publish the image to a public registry such as ghcr.io or Docker Hub.",
      "Name the image in a Compose file or in Helm values, with the repository's own owner and name.",
      "Or give the image location when you start a check.",
    ],
    publiccodeFields: ["container-image"],
  },
  {
    id: "cicd",
    title: "CI/CD configuration",
    source: "checklist",
    standardForPublicCode: "use-continuous-integration",
    what: "Pipeline configuration for continuous integration or delivery, such as GitHub Actions or GitLab CI.",
    why: "Automated builds and tests on every change keep the main branch working.",
    howToPass: ["Add a workflow that builds and tests the component, for example under .github/workflows."],
  },
  {
    id: "openapi",
    title: "OpenAPI specification",
    source: "checklist",
    standardForPublicCode: "use-open-standards",
    what: "A machine-readable OpenAPI or Swagger document for the component's API.",
    why: "Common Ground components work together through APIs. A specification lets others build against the API without reading the code.",
    howToPass: [
      "Publish an OpenAPI document in the repository, for example openapi.yaml.",
      "Or give its location when you start a check.",
    ],
  },
  {
    id: "adrvalidator",
    title: "API Design Rules",
    source: "checklist",
    alsoFrom: ["alv"],
    standardForPublicCode: "use-open-standards",
    what: "The OpenAPI documents follow the NL API Design Rules, checked with the official Spectral rule set.",
    why: "APIs that follow the same rules are easier to connect to. The Design Rules are a mandatory standard for Dutch government APIs.",
    howToPass: [
      "Run Spectral with the API Design Rules rule set on your OpenAPI documents.",
      "Fix every error. Warnings give a warning, not a fail.",
    ],
  },
  {
    id: "standards",
    title: "Supported standards",
    source: "information",
    alsoFrom: ["alv"],
    standardForPublicCode: "use-open-standards",
    sourceNote: "Context for the Common Ground standard v1.0, which lists each component with the versions of its APIs.",
    what: "The standards and versions the component declares in publiccode.yml under supports, compared with the OpenAPI files in the repository.",
    why: "A municipality needs to know which version of a standard, such as the ZGW APIs, the component speaks.",
    howToPass: [
      "There is nothing to pass: the criterion is informative.",
      "Declare each standard and version in publiccode.yml under supports, as the Common Ground profile describes.",
    ],
    publiccodeFields: ["standards"],
  },
  {
    id: "helmchart",
    title: "Helm chart (Kubernetes)",
    source: "checklist",
    standardForPublicCode: "make-the-codebase-reusable-and-portable",
    what: "A Helm chart for the component, in the repository or in a chart repository it points to.",
    why: "Haven, the Common Ground hosting standard, runs on Kubernetes. A Helm chart is the standard way to install a component there.",
    howToPass: [
      "Add a Chart.yaml with the chart, or point to the chart repository.",
      "Or give the chart location when you start a check.",
    ],
    publiccodeFields: ["helm-chart"],
  },
  {
    id: "sbom",
    title: "SBOM",
    source: "checklist",
    what: "A software bill of materials in SPDX or CycloneDX format.",
    why: "An SBOM lists every dependency. With it, a municipality can see at once whether a new vulnerability affects them.",
    howToPass: [
      "Generate an SBOM in your build, for example with Syft or the CycloneDX tools.",
      "Commit it or publish it with the release, under a name such as sbom.spdx.json or cyclonedx.json.",
    ],
  },
  {
    id: "artifacthub",
    title: "Helm chart on Artifact Hub, images scanned",
    source: "checklist",
    sourceNote: "A measurement for the Helm chart criterion: Artifact Hub scans the images the chart installs.",
    what: "The Helm chart is registered on Artifact Hub, which scans its container images with Trivy. The latest version has no critical vulnerabilities.",
    why: "A chart that installs images with critical vulnerabilities puts every municipality that installs it at risk.",
    howToPass: [
      "Register the chart repository on Artifact Hub.",
      "Link the package from publiccode.yml or the README, so the checker finds it.",
      "Fix critical vulnerabilities in the images and publish a new chart version.",
    ],
    publiccodeFields: ["helm-chart"],
  },
  {
    id: "documentation",
    title: "Documentation",
    source: "checklist",
    standardForPublicCode: "document-the-code",
    what: "A README, a docs folder or a link to a documentation site.",
    why: "Others can only install, use and maintain a component they can read about.",
    howToPass: ["Add a README that explains what the component does and how to install it.", "Add a docs folder or link to the documentation site."],
  },
  {
    id: "changelog",
    title: "Changelog",
    source: "checklist",
    standardForPublicCode: "document-codebase-maturity",
    what: "A changelog or release notes file.",
    why: "A changelog tells a municipality what changed in an update before they install it.",
    howToPass: ["Add a CHANGELOG.md, for example in the Keep a Changelog format.", "Add an entry for every release."],
  },
  {
    id: "tests",
    title: "Test suite",
    source: "checklist",
    standardForPublicCode: "use-continuous-integration",
    what: "Automated tests or test configuration in the repository.",
    why: "Tests show that the code does what it should, and that a change does not break it.",
    howToPass: ["Add unit or integration tests and the configuration to run them."],
  },
  {
    id: "coverage",
    title: "Code coverage",
    source: "checklist",
    standardForPublicCode: "use-continuous-integration",
    what: "The share of the code that the tests run, from a coverage report or a coverage figure in the repository.",
    why: "High coverage makes it likely that a broken change is caught before it is released.",
    howToPass: ["Publish a coverage report or badge from your test run.", "Reach at least 80% coverage."],
  },
  {
    id: "testcoderatio",
    title: "Test code ratio",
    source: "sig",
    sourceNote: "SIG uses the test code ratio as a measure of testability.",
    what: "Lines of test code relative to lines of production code, rated from 1 to 5 stars.",
    why: "It works without a coverage report. A ratio of 100% corresponds roughly to 80% coverage.",
    howToPass: ["Write tests alongside the code.", "120% gives five stars, 100% four, 75% three and 25% two."],
  },
  {
    id: "complexity",
    title: "Cyclomatic complexity (Lizard)",
    source: "checklist",
    alsoFrom: ["sig"],
    what: "The average and maximum cyclomatic complexity of the functions, measured with Lizard.",
    why: "Functions with many paths are hard to understand and to test.",
    tool: "lizard",
    howToPass: [
      "Split complex functions into smaller ones.",
      "Keep the average complexity at 15 or less and the highest at 30 or less. An administrator can change these limits.",
    ],
  },
  {
    id: "maintainability",
    title: "Maintainability (ISO 25010)",
    source: "sig",
    what: "An estimate of 1 to 5 stars for maintainability, from unit size, unit complexity, unit interfacing, duplication, module coupling and component structure.",
    why: "Maintainable code is cheaper to change and to hand over. Suitable for Common Ground asks at least 4 stars, the level at which SIG and TÜViT certify. The checker does not certify.",
    howToPass: [
      "Keep units short and simple, with few parameters.",
      "Remove duplicated code.",
      "Keep modules loosely coupled.",
      "4 stars or more passes, 3 stars warns, fewer fails.",
    ],
    components: COMPONENTS_DOC,
  },
  {
    id: "opentrack",
    title: "Maintainability, open track",
    source: "information",
    alsoFrom: ["sig"],
    sourceNote: "An open counterpart of the SIG estimate, with thresholds derived from a public benchmark.",
    what: "Seven code properties rated against open thresholds, derived from 60 public Common Ground and government repositories with the method of Alves (2010, 2011).",
    why: "Anyone can check and repeat the open track: the benchmark, the measurements and the thresholds are public.",
    tool: "lizard and jscpd, rated against the open benchmark thresholds",
    howToPass: ["There is nothing to pass: the criterion is informative.", "The same changes that improve maintainability improve the open track."],
  },
  {
    id: "coupling",
    title: "Coupling (open track)",
    source: "information",
    alsoFrom: ["sig"],
    what: "Module coupling, component independence, component entanglement and dependency cycles, from the module dependency graph.",
    why: "Loosely coupled code can be changed in one place without breaking another.",
    tool: "pdepend for PHP, grimp for Python and dependency-cruiser for JavaScript, TypeScript and Vue",
    howToPass: ["There is nothing to pass: the criterion is informative.", "Break dependency cycles and reduce imports across components."],
    components: COMPONENTS_DOC,
  },
  {
    id: "duplication",
    title: "Duplication (open track)",
    source: "information",
    alsoFrom: ["sig"],
    what: "Duplicated lines per language, over the production code the maintainability estimate rates.",
    why: "Duplicated code has to be fixed in every copy.",
    tool: "jscpd",
    howToPass: ["There is nothing to pass: the criterion is informative.", "Move repeated code into shared functions."],
  },
  {
    id: "size",
    title: "Size",
    source: "information",
    alsoFrom: ["sig"],
    what: "Lines of production code per language, and an estimate of the effort to rebuild it.",
    why: "Size puts the other measurements in context. A small component and a large one are not maintained the same way.",
    tool: "scc",
    howToPass: ["There is nothing to pass: the criterion is informative."],
  },
  {
    id: "sonarqube",
    title: "External comparison: SonarQube",
    source: "information",
    what: "The technical debt ratio and the open issues of four SIG-like rules, from a SonarQube server that already analyses the component.",
    why: "It lets you compare the estimate with a tool you may already use.",
    tool: "the SonarQube web API, when a server is configured",
    howToPass: ["There is nothing to pass: the criterion is informative."],
  },
  {
    id: "codemetrics",
    title: "Code metrics",
    source: "checklist",
    alsoFrom: ["sig"],
    what: "Lines of code, number of functions and number of files.",
    why: "The figures put the other measurements in context.",
    tool: "lizard",
    howToPass: ["There is nothing to pass: the criterion is informative."],
  },
  {
    id: "opensourcehealth",
    title: "Open Source Health",
    source: "sig",
    sourceNote: "SIG's Open Source Health model, as described in its guidance for producers.",
    what: "The third-party dependencies, rated on known vulnerabilities, freshness, activity, licence risk and dependency management.",
    why: "Most of a component's code is in its dependencies. A vulnerable or abandoned dependency is a risk for every municipality that runs it.",
    howToPass: [
      "Update dependencies with known vulnerabilities.",
      "Keep dependencies recent and replace abandoned ones.",
      "Commit lockfiles, so the versions are fixed.",
    ],
  },
  {
    id: "owaspsecurecoding",
    title: "OWASP secure coding",
    source: "checklist",
    what: "A heuristic scan for risky patterns: dynamic code execution, unsafe HTML, shell commands, insecure deserialisation, weak hashes, disabled TLS checks and hardcoded secrets.",
    why: "These patterns are common causes of vulnerabilities in the OWASP Top Ten.",
    howToPass: [
      "Replace the patterns the result names with a safe alternative.",
      "The scan is a heuristic, not a full static analysis. A pattern in a safe context still counts.",
    ],
  },
  {
    id: "secretscanning",
    title: "No committed secrets",
    source: "checklist",
    sourceNote: "A measurement for the security criteria: committed secrets are a hardcoded-credentials weakness (CWE-798).",
    what: "The working tree, scanned for committed secrets such as API keys, tokens and private keys. Test paths are left out.",
    why: "A secret in a public repository can be used by anyone who finds it.",
    howToPass: [
      "Remove the secret and revoke it: it is public already.",
      "Load secrets from the environment or a secret store.",
      "Mark a known false positive in .gitleaksignore.",
    ],
  },
  {
    id: "openssfscorecard",
    title: "OpenSSF Scorecard",
    source: "checklist",
    standardForPublicCode: "use-continuous-integration",
    sourceNote: "A measurement for the security criteria: branch protection, safe workflows and signed releases.",
    what: "The repository's OpenSSF Scorecard from 0 to 10, read from the public Scorecard API and rated from 1 to 5 stars.",
    why: "The Scorecard checks how well the project protects itself against supply-chain attacks.",
    howToPass: [
      "Run the Scorecard action and fix the checks it reports.",
      "9 or higher gives five stars, 7 four, 5 three and 3 two. These bands are the checker's own.",
    ],
  },
  {
    id: "contributing",
    title: "Contributing guide",
    source: "checklist",
    standardForPublicCode: "welcome-contributors",
    what: "A CONTRIBUTING file.",
    why: "It tells other developers how to propose a change, run the checks and open a pull request.",
    howToPass: ["Add a CONTRIBUTING.md to the root or the .github folder."],
  },
  {
    id: "codeofconduct",
    title: "Code of conduct",
    source: "checklist",
    standardForPublicCode: "welcome-contributors",
    what: "A CODE_OF_CONDUCT file.",
    why: "It sets the expected behaviour and how to report a problem, so contributors feel safe to take part.",
    howToPass: ["Add a CODE_OF_CONDUCT.md, for example the Contributor Covenant."],
  },
  {
    id: "security",
    title: "Security policy",
    source: "checklist",
    what: "A SECURITY file.",
    why: "It tells someone who finds a vulnerability how to report it privately, before it is public.",
    howToPass: ["Add a SECURITY.md with a private reporting channel and the supported versions."],
  },
  {
    id: "projecthealth",
    title: "Project health (CHAOSS)",
    source: "information",
    what: "How active and widely carried the project is: the bus factor, the spread over organisations, how change requests and issues are handled, and how often it releases.",
    why: "A project that rests on one person or one organisation is at risk when they stop.",
    tool: "the CHAOSS metrics, computed from the git history and the issue tracker",
    howToPass: ["There is nothing to pass: the criterion is informative."],
  },
  {
    id: "semver",
    title: "Semantic versioning",
    source: "checklist",
    standardForPublicCode: "maintain-version-control",
    what: "The releases and tags follow semantic versioning: MAJOR.MINOR.PATCH.",
    why: "A version number that follows the rules tells a municipality whether an update can break their setup.",
    howToPass: ["Tag releases as MAJOR.MINOR.PATCH, with or without a leading v."],
    publiccodeFields: ["software-version"],
  },
  {
    id: "agentinstructions",
    title: "Agent instructions",
    source: "agents",
    what: "An instruction file for coding agents: AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md, Cursor, Windsurf or Cline rules. The checker reads up to five of them and measures the longest and whether one names a build, test or lint command.",
    why: "An agent that starts without instructions guesses how to build and test. It then breaks conventions a person would know. One short file prevents that.",
    howToPass: [
      "Add an AGENTS.md in the root of the repository.",
      "Name the commands to install, build, test and lint, such as npm test or composer check.",
      "Describe the layout, the conventions and the traps, in at least 1,000 characters.",
    ],
  },
  {
    id: "specifications",
    title: "Specifications",
    source: "agents",
    what: "Specification files in a layout agents know: openspec/specs/<capability>/spec.md with changes under openspec/changes, Spec Kit's specs/<feature>/spec.md, or Kiro's .kiro/specs.",
    why: "A specification tells an agent what the code must do. Without one, the agent can only copy what the code happens to do now.",
    howToPass: [
      "Write one spec per capability in openspec/specs/<capability>/spec.md.",
      "Propose new work as a change in openspec/changes/<change>/.",
      "25 specifications rate 5; with changes the rating is 5.5.",
    ],
  },
  {
    id: "architecturedecisions",
    title: "Architecture decision records",
    source: "agents",
    what: "Numbered architecture decision records, such as 0001-use-postgres.md or adr-001-api.md, in docs/adr, docs/decisions, adr, decisions or openspec/architecture.",
    why: "A decision record says why the code is built this way. An agent that cannot read it may undo a choice that was made on purpose.",
    howToPass: [
      "Record each architecture decision as a numbered file in docs/adr.",
      "Ten or more records rate 5.5.",
    ],
  },
  {
    id: "devenvironment",
    title: "Runnable development environment",
    source: "agents",
    what: "A dev container or Docker Compose file, and a command each to test, lint and build in package.json, composer.json, a Makefile, justfile, Taskfile, pyproject.toml, tox.ini or noxfile.py. Maven, Gradle, Go and Cargo give test and build by convention.",
    why: "An agent checks its own change by running it. It can only do that when the environment starts with one command and the checks have names.",
    howToPass: [
      "Add a .devcontainer/devcontainer.json or a docker-compose.yml for development.",
      "Add test, lint and build scripts to package.json, composer.json or a Makefile.",
    ],
  },
  {
    id: "machineinterfaces",
    title: "Machine-readable interfaces",
    source: "agents",
    what: "OpenAPI or Swagger documents, an llms.txt and an MCP configuration such as .mcp.json, outside vendored code and test fixtures.",
    why: "An agent that reads the API from an OpenAPI document does not have to guess it from the code. An llms.txt and an MCP configuration point it at the documentation and tools.",
    howToPass: [
      "Publish the OpenAPI document of every API in the repository.",
      "Add an llms.txt that links the documentation an agent should read.",
      "Commit the MCP configuration the team uses, such as .mcp.json, without secrets.",
    ],
  },
  {
    id: "agenttooling",
    title: "Agent tooling",
    source: "agents",
    what: "Skills, prompts and commands for agents (.claude/skills, .claude/commands, .claude/agents, .github/prompts, .cursor/commands, .agents/skills), and local quality gates: pre-commit, Husky, Lefthook, or gate and check scripts under scripts/ or bin/.",
    why: "Skills turn the team's way of working into steps an agent repeats. A local gate lets the agent find its own mistakes before a person has to.",
    howToPass: [
      "Add a pre-commit configuration or a gate script that runs the checks.",
      "Write the team's recurring tasks as skills or prompts; ten or more give the most points.",
    ],
  },
];

const DOCS_BY_ID = new Map(CRITERION_DOCS.map((doc) => [doc.id, doc]));

export function findCriterionDoc(id: string): CriterionDoc | undefined {
  return DOCS_BY_ID.get(id);
}

export interface CriterionAspectRef {
  id: string;
  title: string;
  /** The category of the aspect model the aspect belongs to */
  modelCategory: string;
  /** The aspect's section in the rating guide, when there is one */
  href?: string;
}

export interface ResolvedCriterionDoc extends CriterionDoc {
  href: string;
  /** False for a criterion that lives in an open change */
  measured: boolean;
  category: CriteriaCategory | string;
  level: RequirementLevel;
  /** False when the criterion never counts in the score */
  counted: boolean;
  aspects: CriterionAspectRef[];
  /** The tool that measures the criterion */
  measuredWith?: string;
  introducedIn: string | null;
  mandatoryFrom: string | null;
  fields: { id: string; keys: string; href: string }[];
  referenceSources: { title: string; url: string }[];
}

function aspectRefs(id: string, planned?: PlannedCriterion): CriterionAspectRef[] {
  const refs: CriterionAspectRef[] = [];
  for (const category of ASPECT_MODEL) {
    for (const aspect of category.aspects) {
      const { source } = aspect;
      const feeds = "checkId" in source ? source.checkId === id : source.checkIds.includes(id);
      if (feeds) refs.push({ id: aspect.id, title: aspect.title, modelCategory: category.category });
    }
  }
  if (refs.length === 0 && planned?.aspect) {
    const category = ASPECT_MODEL.find((candidate) => candidate.aspects.some((aspect) => aspect.id === planned.aspect));
    const aspect = category?.aspects.find((candidate) => candidate.id === planned.aspect);
    if (category && aspect) refs.push({ id: aspect.id, title: aspect.title, modelCategory: category.category });
  }
  return refs.map((ref) => {
    const guide = RATING_DOCS.find((category) => category.aspects.some((aspect) => aspect.id === ref.id));
    return guide ? { ...ref, href: aspectDocHref(guide.slug, ref.id) } : ref;
  });
}

function measuredWith(id: string): string | undefined {
  for (const category of RATING_DOCS) {
    for (const aspect of category.aspects) {
      const criterion = aspect.criteria.find((candidate) => candidate.checkId === id);
      if (criterion) return criterion.tool;
    }
  }
  return undefined;
}

function referenceSources(id: string): { title: string; url: string }[] {
  const seen = new Map<string, { title: string; url: string }>();
  for (const category of RATING_DOCS) {
    for (const aspect of category.aspects) {
      if (!aspect.criteria.some((criterion) => criterion.checkId === id)) continue;
      for (const source of aspect.sources) seen.set(source.url, source);
    }
  }
  return [...seen.values()];
}

/**
 * A criterion's page content with the facts this version of the checker
 * holds: its category, requirement level, weight and checklist version. A
 * planned criterion falls back to the values it carries itself.
 */
export function resolveCriterionDoc(
  doc: CriterionDoc,
  config: Record<string, { weight: number; requirementLevel: RequirementLevel }>
): ResolvedCriterionDoc {
  const measured = RESULT_ORDER_BY_ID.includes(doc.id);
  const criterionConfig = config[doc.id];
  const level = criterionConfig?.requirementLevel ?? doc.planned?.level ?? "informative";
  const plannedCategory = doc.planned ? resolveCategory(doc.planned.category) ?? doc.planned.category : undefined;
  const version = CRITERION_VERSIONS[doc.id];
  return {
    ...doc,
    href: criterionDocHref(doc.id),
    measured,
    category: RESULT_CATEGORY_BY_ID[doc.id] ?? plannedCategory ?? "Information",
    level,
    counted: criterionConfig ? criterionConfig.weight > 0 && level !== "informative" : level !== "informative",
    aspects: aspectRefs(doc.id, doc.planned),
    measuredWith: measuredWith(doc.id) ?? doc.tool,
    introducedIn: version?.introducedIn ?? null,
    mandatoryFrom: level === "mandatory" ? version?.mandatoryFrom ?? null : null,
    fields: (doc.publiccodeFields ?? []).flatMap((fieldId) => {
      const field = PROFILE_FIELDS.find((candidate) => candidate.id === fieldId);
      return field ? [{ id: field.id, keys: field.keys, href: `${PUBLICCODE_PROFILE_PATH}#${field.id}` }] : [];
    }),
    referenceSources: referenceSources(doc.id),
  };
}

/** The criteria in the order of the report, then the ones that live in an open change. */
export function orderedCriterionDocs(): CriterionDoc[] {
  const position = (id: string) => {
    const index = RESULT_ORDER_BY_ID.indexOf(id);
    return index === -1 ? RESULT_ORDER_BY_ID.length : index;
  };
  return [...CRITERION_DOCS].sort((a, b) => position(a.id) - position(b.id));
}
