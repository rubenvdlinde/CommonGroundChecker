import { criterionDocHref } from "./criteria";
import { PATH_DOC_HREF, PATH_DOC_SOURCES } from "./pathDocs";
import { PUBLICCODE_PROFILE_PATH } from "./publiccodeProfile";
import { STANDARD_FOR_PUBLIC_CODE_URL } from "./standardForPublicCode";
import { TOOLS_DOC_HREF } from "./toolsDocs";
import {
  ALV_AGENDA_URL,
  ALV_EXPLANATION_URL,
  ALV_STANDARD_URL,
  HUGO_REPOSITORY_URL,
  PUBLICCODE_YML_STANDARD_URL,
  SETUP_ISSUE_URL,
  SIG_QUALITY_MODELS_URL,
} from "./aboutDocs";

/**
 * One block on the About page. "setup" and "stick" blocks render a point of
 * SETUP_POINTS or MEASURING_STICK_PARTS with the anchor it always had; a
 * "page" block is content the page renders itself.
 */
export type AboutBlock = { kind: "setup"; id: string } | { kind: "stick"; id: string } | { kind: "page"; id: string };

export interface AboutSection {
  id: string;
  title: string;
  /** Old anchors that now land on this section */
  aliases?: string[];
  blocks: AboutBlock[];
}

const setup = (id: string): AboutBlock => ({ kind: "setup", id });
const stick = (id: string): AboutBlock => ({ kind: "stick", id });
const page = (id: string): AboutBlock => ({ kind: "page", id });

/** The About page, in the order a reader who arrives cold needs it. */
export const ABOUT_SECTIONS: AboutSection[] = [
  { id: "what-it-is", title: "What the checker is, and what it is not", blocks: [page("what-it-is"), page("about-common-ground")] },
  {
    id: "measuring-stick",
    title: "The problem it answers",
    blocks: [page("measuring-stick-intro"), stick("problem"), stick("grounds")],
  },
  { id: "principle", title: "Our principle: choose tools, do not build them", blocks: [page("principle")] },
  {
    id: "criteria-sources",
    title: "Where the criteria come from",
    aliases: ["checklist-sources"],
    blocks: [page("criteria-sources"), page("sources-and-measurements"), page("own-additions")],
  },
  { id: "publiccode-basis", title: "publiccode.yml as the basis", blocks: [page("publiccode-basis")] },
  {
    id: "rating",
    title: "How a component is rated",
    blocks: [page("rating"), setup("three-systems"), setup("ai-readiness"), page("checklist-versions")],
  },
  {
    id: "levels-and-lifecycle",
    title: "Levels and lifecycle",
    blocks: [
      setup("levels"),
      page("common-ground-lifecycle"),
      page("component-lifecycle"),
      page("lifecycles-relation"),
      page("basisset"),
    ],
  },
  { id: "maintenance", title: "Maintenance and SLA", blocks: [stick("maintenance"), setup("maintenance")] },
  {
    id: "comparing",
    title: "Comparing, functionalities and overlap",
    blocks: [stick("mapping"), stick("comparing"), stick("development"), setup("organisations")],
  },
  {
    id: "setup",
    title: "The setup and the way into the standard",
    blocks: [
      page("setup-intro"),
      setup("goal-open-space"),
      setup("goal-better-code"),
      setup("goal-neutral-rating"),
      setup("goal-trust"),
      setup("checklist"),
      page("adoption"),
      setup("code-overheid"),
    ],
  },
  { id: "run", title: "Run it yourself", blocks: [page("run"), page("check")] },
  { id: "references", title: "Sources and references", blocks: [page("references"), page("credits")] },
];

/**
 * Anchors other pages, links and readers may use. Each must still exist on
 * the page: as a section, an alias, a setup point (setup-<id>), a measuring
 * stick part (measuring-stick-<id>) or an element of its own.
 */
export const KEPT_ANCHORS: string[] = [
  "check",
  "measuring-stick",
  "setup",
  "checklist-sources",
  "adoption",
  "common-ground-lifecycle",
  "component-lifecycle",
  "lifecycles-relation",
];

export const WHAT_IT_IS: string[] = [
  "The Common Ground Component Checker helps teams quickly assess whether a public GitHub repository aligns with key Common Ground practices. It runs automated checks (such as open standards, governance files, deployability, documentation, and versioning) and produces a transparent score with evidence per criterion.",
  "The goal is to support better decision-making, highlight improvement areas, and make reusable public-sector software easier to evaluate over time.",
  "The checker is not a certificate, not a catalogue and not a decision. It estimates what SIG and TÜViT certify, but it does not certify. It measures, and a register such as developer.overheid.nl can show the measurements. VNG, as regievoerder, decides which component enters the Common Ground standard.",
];

export const ABOUT_COMMON_GROUND =
  "Common Ground is a Dutch government initiative that promotes modern, interoperable, and reusable digital public services. Instead of isolated monolithic systems, municipalities are encouraged to use open standards, modular components, and well-defined APIs so solutions can be shared and improved across organizations.";

export const PRINCIPLE: string[] = [
  "We do not build measurement tools. We choose existing open tools, such as lizard, jscpd, gitleaks, Spectral and the OpenSSF Scorecard. The checker runs them the same way on every component.",
  "The lines are not ours either. Common Ground already draws them: in Hugo ter Doest's proposal, in the SIG ratings the programme uses, in the ALV decisions and in the Standard for Public Code. The checker makes those lines visible per component.",
  "Every tool, its version and its thresholds are published. A number counts only when a tool produced it.",
];

export const CRITERIA_SOURCES_INTRO =
  "The checklist rests on four sources. What the checklist asks decides whether a component is suitable for Common Ground and whether it can be Maintained.";

export const SOURCES_DIAGRAM_INTRO =
  "On the left the four sources, plus our own additions. On the right what the checker measures, grouped by the tool that measures it. A line is thicker when more measures follow from that source. Select a source to see only its measures. On a phone the lines go, and the coloured dots on each measure name its sources.";

export const OWN_ADDITIONS =
  "We added a few measures of our own. They are informative: shown, never counted in a rating or the verdict. AI readiness shows how easily a coding agent can start on the repository. Project health uses the CHAOSS metrics. The SonarQube comparison puts SonarQube's figures next to the checker's, when a SonarQube server is set.";

export const PUBLICCODE_BASIS: string[] = [
  "Is publiccode.yml the basis of the setup? Partly, and the line is sharp.",
  "publiccode.yml is the basis for everything the checker cannot read from the code. That is the name, the description and the logo, the development status, who uses the component, who maintains it and on which terms, and which standards it supports. The Common Ground profile says what to put there.",
  "Suitable for Common Ground and Maintained read it. Stable comes from developmentStatus, the users from usedBy and the contract from maintenance.",
  "The code measurements stand on their own. Maintainability, security, tests and the other code criteria do not read publiccode.yml. Without the file a component still gets those measurements. It fails the publiccode.yml criterion, though, so it cannot become suitable.",
];

export interface PubliccodeUse {
  feature: string;
  fields: string;
  href?: string;
}

/** Which features of the checker read which publiccode.yml fields. */
export const PUBLICCODE_USES: PubliccodeUse[] = [
  {
    feature: "The publiccode.yml criterion (mandatory)",
    fields: "the file, publiccodeYmlVersion, name, url, legal",
    href: criterionDocHref("publiccode"),
  },
  { feature: "Which version is measured", fields: "softwareVersion", href: `${PATH_DOC_HREF}#version` },
  {
    feature: "Name, description and features on the component page and the compare page",
    fields: "name, localisedName, description (shortDescription, longDescription, features), landingURL, platforms, dependsOn",
  },
  { feature: "The logo on the component page", fields: "logo" },
  {
    feature: "The Maintenance contract criterion",
    fields: "maintenance.type, maintenance.contractors (name, until, email)",
    href: criterionDocHref("maintenance"),
  },
  {
    feature: "Suitable for Common Ground",
    fields: "developmentStatus (stable), usedBy (at least 2), maintenance (a valid contract)",
    href: "#setup-levels",
  },
  { feature: "Maintained", fields: "everything Suitable reads, plus an SLA on the VNG model contract", href: "#setup-levels" },
  { feature: "Retired in the lifecycle", fields: "developmentStatus: obsolete", href: "#common-ground-lifecycle" },
  { feature: "The Users pages and the usage criterion", fields: "usedBy", href: criterionDocHref("usage") },
  {
    feature: "Contributors in the usage criterion: telling the owner from outside contributors",
    fields: "organisation, maintenance contacts and contractors, legal.repoOwner, legal.mainCopyrightOwner",
  },
  { feature: "The Common Ground 5-layer architecture criterion", fields: "supports (the layer)", href: criterionDocHref("fivelayer") },
  { feature: "The Supported standards criterion", fields: "supports (standards and versions)", href: criterionDocHref("standards") },
  {
    feature: "The licence criteria",
    fields: "legal.license, compared with the LICENSE file and the package manifests",
    href: criterionDocHref("licenceconsistency"),
  },
  {
    feature: "The Helm chart and Artifact Hub criteria",
    fields: "an Artifact Hub link in the description",
    href: criterionDocHref("artifacthub"),
  },
];

export const PUBLICCODE_NOT_READ =
  "Providers do not come from publiccode.yml. A provider is the owner of the repository, the GitHub user or organisation or the GitLab group. The functionalities of a component come from the component list, not from publiccode.yml.";

export const RATING_TEXT: string[] = [
  "The checker groups its criteria into categories, such as Governance, Security and Software Quality. Each criterion passes, warns or fails. The results add up to 1 to 5 stars per aspect, per category and overall, with the same criteria and thresholds for every component.",
  "Some criteria are mandatory. A mandatory criterion that fails stops a component from being suitable, whatever its stars. Informative categories, such as AI readiness, have their own stars but never count in the overall rating.",
];

export const BASISSET_TEXT =
  "The basisset of the Common Ground standard lists the components the programme supports, with their versions. The basisset page puts the version of each component next to the version the checker measured.";

export const RUN_TEXT =
  "The checker is open source. Run it on a server with the check form, or as a static site that scans a fixed list of components every night and needs no server.";

export interface Reference {
  title: string;
  url: string;
}

/** Every outside source the page leans on, once. */
export const ABOUT_REFERENCES: Reference[] = [
  { title: "Hugo ter Doest's Component Checker and its README", url: `${HUGO_REPOSITORY_URL}#readme` },
  { title: "The setup behind the checker (issue #54)", url: SETUP_ISSUE_URL },
  { title: "The SIG quality models", url: SIG_QUALITY_MODELS_URL },
  { title: "The Common Ground standard v1.0 (PDF)", url: ALV_STANDARD_URL },
  { title: "The explanation of the Common Ground proposal (PDF)", url: ALV_EXPLANATION_URL },
  { title: "Agenda and papers of the ALV of 11 December 2026", url: ALV_AGENDA_URL },
  { title: "The Standard for Public Code", url: STANDARD_FOR_PUBLIC_CODE_URL },
  { title: "The publiccode.yml standard", url: PUBLICCODE_YML_STANDARD_URL },
  ...PATH_DOC_SOURCES.filter(
    (source) => ![SETUP_ISSUE_URL, ALV_STANDARD_URL, ALV_AGENDA_URL].includes(source.url),
  ).map((source) => ({ title: source.title, url: source.url })),
  { title: "code.overheid.nl", url: "https://code.overheid.nl" },
];

/** Pages of this site the references point to. */
export const ABOUT_SITE_LINKS: Reference[] = [
  { title: "The Common Ground profile of publiccode.yml", url: PUBLICCODE_PROFILE_PATH },
  { title: "Tools and models", url: TOOLS_DOC_HREF },
  { title: "The criteria", url: "/docs/criteria" },
  { title: "The path to Common Ground", url: PATH_DOC_HREF },
  { title: "Run the checker without a server", url: "/docs/run-without-a-server" },
];
