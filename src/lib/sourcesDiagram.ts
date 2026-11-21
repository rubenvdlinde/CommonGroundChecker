import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID } from "./checkers/config";
import { CRITERION_DOCS, findCriterionDoc, resolveCriterionDoc, type CriterionSource } from "./criterionDocs";
import { BASISSET_PAGE_HREF, COMPARE_PAGE_HREF, FUNCTIONALITIES_PAGE_HREF } from "./measuringStickDocs";
import { sfpcNotMeasuredList } from "./standardForPublicCode";

/** The sources the diagram draws on the left, with our own informative additions last. */
export type DiagramSourceId = "hugo" | "sig" | "alv" | "fpc" | "own";

export const DIAGRAM_SOURCE_ORDER: DiagramSourceId[] = ["hugo", "sig", "alv", "fpc", "own"];

export interface DiagramSource {
  id: DiagramSourceId;
  name: string;
  text: string;
  items?: string[];
}

export interface DiagramMeasure {
  /** The criterion id, or an id of its own for a measure that is not a criterion */
  id: string;
  name: string;
  sources: DiagramSourceId[];
  /** Shown but never counted in the overall rating or the verdict */
  informative: boolean;
  href?: string;
}

export interface DiagramGroup {
  id: string;
  name: string;
  tool: string;
  measures: DiagramMeasure[];
}

export interface SourcesDiagramData {
  sources: (DiagramSource & { count: number })[];
  groups: DiagramGroup[];
}

const CRITERION_SOURCE_TO_DIAGRAM: Record<CriterionSource, DiagramSourceId | null> = {
  checklist: "hugo",
  sig: "sig",
  alv: "alv",
  information: null,
  agents: null,
};

/** A measure that is not a criterion: a level, a page or a count the checker derives from the results. */
interface ExtraMeasure {
  id: string;
  name: string;
  sources: DiagramSourceId[];
  informative: boolean;
  href?: string;
}

/** One group per tool. A criterion is listed by id; the diagram takes its name and sources from the criterion docs. */
const GROUPS: { id: string; name: string; tool: string; criteria: string[]; extra?: ExtraMeasure[] }[] = [
  {
    id: "repository",
    name: "Repository inspection",
    tool: "the checker, on the file tree and file contents",
    criteria: [
      "sourcecode",
      "fivelayer",
      "license",
      "eupllicense",
      "licenceconsistency",
      "copyrightowner",
      "docker",
      "helmchart",
      "sbom",
      "cicd",
      "documentation",
      "changelog",
      "tests",
      "coverage",
      "contributing",
      "codeofconduct",
      "security",
      "semver",
    ],
  },
  {
    id: "publiccode",
    name: "publiccode.yml",
    tool: "the publiccode.yml parser and the Common Ground profile",
    criteria: ["publiccode", "maintenance", "standards"],
    extra: [{ id: "used-by", name: "Users under usedBy", sources: ["alv"], informative: false }],
  },
  { id: "spdx", name: "Licence headers", tool: "a REUSE and SPDX scan", criteria: ["spdxheaders"] },
  { id: "apis", name: "APIs", tool: "OpenAPI detection, Spectral with the API Design Rules", criteria: ["openapi", "adrvalidator"] },
  {
    id: "images",
    name: "Images and charts",
    tool: "container registries, Artifact Hub and Trivy",
    criteria: ["dockerimage", "artifacthub"],
  },
  { id: "complexity", name: "Complexity", tool: "lizard", criteria: ["complexity", "codemetrics"] },
  {
    id: "maintainability",
    name: "Maintainability",
    tool: "the estimate with lizard, jscpd, scc, pdepend, grimp and dependency-cruiser",
    criteria: ["maintainability", "testcoderatio", "opentrack", "coupling", "duplication", "size"],
  },
  { id: "comparison", name: "Comparison", tool: "the SonarQube API, when a server is set", criteria: ["sonarqube"] },
  { id: "dependencies", name: "Dependencies", tool: "OSV on the lockfiles", criteria: ["opensourcehealth"] },
  { id: "secure-coding", name: "Secure coding", tool: "the checker's own OWASP patterns", criteria: ["owaspsecurecoding"] },
  { id: "secrets", name: "Secrets", tool: "gitleaks", criteria: ["secretscanning"] },
  { id: "practice", name: "Security practice", tool: "the OpenSSF Scorecard API", criteria: ["openssfscorecard"] },
  {
    id: "use",
    name: "Use and health",
    tool: "git history, the issue tracker and package registries",
    criteria: ["usage", "projecthealth"],
  },
  {
    id: "verdict",
    name: "Verdict and lifecycle",
    tool: "rules over the results, the VNG basisset and GEMMA",
    criteria: [],
    extra: [
      { id: "suitable", name: "Suitable for Common Ground", sources: ["alv"], informative: false },
      { id: "maintained", name: "Maintained", sources: ["alv"], informative: false },
      { id: "basisset", name: "Basisset match", sources: ["alv"], informative: true, href: BASISSET_PAGE_HREF },
      { id: "functionalities", name: "Functionalities (GEMMA)", sources: ["alv"], informative: true, href: FUNCTIONALITIES_PAGE_HREF },
      { id: "compare", name: "Comparing and overlap", sources: ["alv"], informative: true, href: COMPARE_PAGE_HREF },
    ],
  },
  {
    id: "ai-readiness",
    name: "AI readiness",
    tool: "a look at the file tree, our own addition",
    criteria: ["agentinstructions", "specifications", "architecturedecisions", "devenvironment", "machineinterfaces", "agenttooling"],
  },
];

export const DIAGRAM_SOURCES: DiagramSource[] = [
  {
    id: "hugo",
    name: "Hugo ter Doest's proposal",
    text: "What a repository must contain: a licence, publiccode.yml, documentation, tests, Docker, Helm, OpenAPI and the other basics.",
  },
  {
    id: "sig",
    name: "SIG ratings",
    text: "Ready for certification by SIG and TÜViT: maintainability under ISO 25010, test code and healthy dependencies. The checker estimates. It does not certify.",
  },
  {
    id: "alv",
    name: "VNG ALV decisions",
    text: "The Common Ground standard v1.0 (ALV 11 December 2026) and the two wishes: take components into maintenance, and remove duplication.",
    items: [
      "Suitable: stable and at least 2 users under usedBy",
      "Maintained: a VNG decision to take it into management",
      "The agreed standards and the API Design Rules",
      "The basisset, and removing duplication through functionalities",
    ],
  },
  {
    id: "fpc",
    name: "Foundation for Public Code",
    text: "The Standard for Public Code: code in the open, an open licence, documentation, open standards, continuous integration, versions and a welcome for contributors.",
    items: [
      `Not measured: ${sfpcNotMeasuredList()}`,
    ],
  },
  {
    id: "own",
    name: "Our own additions",
    text: "AI readiness, CHAOSS project health and the SonarQube comparison. Shown for information, never counted.",
  },
];

/** The sources a criterion follows from, in diagram terms. A criterion with none is our own addition. */
export function criterionDiagramSources(id: string): DiagramSourceId[] {
  const doc = findCriterionDoc(id);
  if (!doc) throw new Error(`no criterion ${id}`);
  const found = new Set<DiagramSourceId>();
  for (const source of [doc.source, ...(doc.alsoFrom ?? [])]) {
    const mapped = CRITERION_SOURCE_TO_DIAGRAM[source];
    if (mapped) found.add(mapped);
  }
  if (doc.standardForPublicCode) found.add("fpc");
  if (found.size === 0) found.add("own");
  return DIAGRAM_SOURCE_ORDER.filter((source) => found.has(source));
}

function criterionMeasure(id: string): DiagramMeasure {
  const doc = findCriterionDoc(id);
  if (!doc) throw new Error(`no criterion ${id}`);
  const resolved = resolveCriterionDoc(doc, DEFAULT_CRITERION_CONFIG_BY_CHECK_ID);
  return {
    id,
    name: doc.title,
    sources: criterionDiagramSources(id),
    informative: !resolved.counted || doc.source === "agents",
    href: resolved.href,
  };
}

/** The ids of the criteria the diagram places, in group order. */
export function diagramCriterionIds(): string[] {
  return GROUPS.flatMap((group) => group.criteria);
}

/** Every source with the number of measures that follow from it, and every tool group with its measures. */
export function sourcesDiagramData(): SourcesDiagramData {
  const groups: DiagramGroup[] = GROUPS.map((group) => ({
    id: group.id,
    name: group.name,
    tool: group.tool,
    measures: [...group.criteria.map(criterionMeasure), ...(group.extra ?? [])],
  }));
  const sources = DIAGRAM_SOURCES.map((source) => ({
    ...source,
    count: groups.reduce((sum, group) => sum + group.measures.filter((measure) => measure.sources.includes(source.id)).length, 0),
  }));
  return { sources, groups };
}

/** The criteria the diagram leaves out; empty when it covers every criterion. */
export function criteriaMissingFromDiagram(): string[] {
  const placed = new Set(diagramCriterionIds());
  return CRITERION_DOCS.map((doc) => doc.id).filter((id) => !placed.has(id));
}
