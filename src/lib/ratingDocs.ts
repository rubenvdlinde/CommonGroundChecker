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
  sources: DocSource[];
}

export interface RatingCategoryDoc {
  /** Stable slug, the path in /docs/<category-slug> */
  slug: string;
  title: string;
  summary: string;
  aspects: RatingAspectDoc[];
}

const SOURCES = {
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
  "These criteria have no scale of their own, so a pass rates 5, a warning 3 and a fail 1. The aspect rating is the weighted mean of its criteria.";

const DOCUMENT_RATING =
  "This is a document aspect. Its rating is the share of the documents that were found: all of them gives 5 stars, at least 80% gives 4, at least 60% gives 3, at least 40% gives 2, and less gives 1.";

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
        ]
      ),
      {
        id: "secrets",
        title: "Secrets",
        meaning:
          "Whether passwords, API keys, tokens or private keys are committed to the repository. A committed secret can be found and used by anyone who reads the code.",
        criteria: [{ checkId: "secretscanning", name: "No committed secrets", tool: "gitleaks 8.30.1" }],
        rating: [
          "gitleaks scans the files of the repository, honouring the project's own .gitleaks.toml and .gitleaksignore. Findings are reported by rule and location, never with the secret itself.",
          "No finding passes, a finding fails. When gitleaks cannot run, the criterion warns. A pass rates 5, a warning 3 and a fail 1.",
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
          "A pass rates 5, a warning 3 and a fail 1. A heuristic finds likely problems, not proven ones, so a finding is a reason to look, not a verdict.",
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
          "The SBOM criterion passes when the repository holds a software bill of materials in SPDX or CycloneDX format, and rates 5 for a pass and 1 for a fail.",
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
      "Maintainability is how easily a component can be understood, changed, tested and reused. ISO/IEC 25010 defines five sub-characteristics. The checker estimates each of them from properties of the source code, the way the published maintainability model does, and adds an aspect for the tests.",
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
          "The test suite criterion passes when test files or test configuration are present. Code coverage passes at 80% line coverage or more. Both rate 5 for a pass, 3 for a warning and 1 for a fail.",
          "The test code ratio is test code lines as a percentage of production code lines. A ratio of 100% corresponds roughly to 80% coverage. 120% or more is 5 stars, 100% is 4, 75% is 3, 25% is 2, and less is 1.",
          "The aspect rating is the weighted mean of the three criteria.",
        ],
        counted: true,
        sources: [SOURCES.testCodeRatio, SOURCES.iso25010],
      },
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
          "The licence, EUPL and licence consistency criteria rate 5 for a pass, 3 for a warning and 1 for a fail. Licence consistency warns when only one declaration is found or when declarations differ only in -only or -or-later.",
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
        criteria: [{ checkId: "fivelayer", name: "5-layer architecture", tool: "the layer declared in publiccode.yml, else signals in paths, file names and the README" }],
        rating: [
          "A component declares its layer in publiccode.yml with the nl.vng profile: `NL: { vng: { commonground: { layer: process } } }`, or, because country sections are deprecated in publiccode.yml 1.0, a `supports` entry with id `https://commonground.nl/cms/view/54476261/5-lagen-model#process`. Dutch names (interactie, proces, integratie, dienst, data) are accepted. One declared layer passes; more than one, or an unknown name, warns.",
          "Without a declaration the check reports the layer or layers it recognises. The result is shown, but it does not count in the Architecture rating, because belonging to one layer or another is not better or worse.",
        ],
        counted: false,
        sources: [SOURCES.fiveLayerModel],
      },
    ],
  },
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
