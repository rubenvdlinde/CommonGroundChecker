/**
 * Known Dutch government standards that a component can declare in publiccode.yml as a
 * `supports` entry, by the official URI of one version of the standard. See
 * docs/publiccode-profile.md for the convention.
 *
 * To add a version, add it to `versions` after checking that its URI resolves at the
 * publisher. To add a standard, add a family with the publisher's per-version URI.
 */

export interface StandardSource {
  title: string;
  url: string;
}

export interface StandardFamily {
  /** Stable kebab-case id */
  id: string;
  name: string;
  /** The set the standard belongs to, for example "ZGW APIs" */
  group?: string;
  /**
   * The URI of one version, with `{version}` where the version goes. Null while no
   * official per-version URI exists: the standard is then recognised only in OpenAPI files.
   */
  uriTemplate: string | null;
  /** Versions whose URI was checked at the publisher */
  versions: string[];
  /** `info.title` of the official OpenAPI specification, to recognise it in a repository */
  openApiTitles?: string[];
  /**
   * Top-level resources every official OpenAPI file of the standard has, checked against each
   * published version; recognises an implementation that gives its specification another title.
   */
  openApiResources?: string[];
  source: StandardSource;
}

const ZGW_SOURCE: StandardSource = {
  title: "VNG Realisatie, ZGW API standaarden",
  url: "https://vng-realisatie.github.io/gemma-zaken/standaard/",
};

function zgw(id: string, name: string, path: string, versions: string[], resources: string[]): StandardFamily {
  return {
    id,
    name,
    group: "ZGW APIs",
    uriTemplate: `https://vng-realisatie.github.io/gemma-zaken/standaard/${path}/redoc-{version}.html`,
    versions,
    openApiTitles: [name],
    openApiResources: resources,
    source: ZGW_SOURCE,
  };
}

const LOGIUS_DIGIKOPPELING: StandardSource = {
  title: "Logius, Digikoppeling",
  url: "https://www.forumstandaardisatie.nl/open-standaarden/digikoppeling",
};

function digikoppeling(id: string, name: string, part: string, versions: string[]): StandardFamily {
  return {
    id,
    name,
    group: "Digikoppeling",
    uriTemplate: `https://gitdocumentatie.logius.nl/publicatie/dk/${part}/{version}/`,
    versions,
    source: LOGIUS_DIGIKOPPELING,
  };
}

export const STANDARD_FAMILIES: StandardFamily[] = [
  zgw("zgw-zaken", "Zaken API", "zaken", [
    "1.0.0", "1.0.1", "1.0.2", "1.1.0", "1.2.0", "1.3.0", "1.3.1", "1.4.0", "1.4.1", "1.5.0", "1.5.1", "1.6.0",
    "1.7.0", "1.8.0",
  ], ["zaken", "statussen", "resultaten"]),
  zgw("zgw-documenten", "Documenten API", "documenten", [
    "1.0.0", "1.0.1", "1.1.0", "1.1.1", "1.2.0", "1.3.0", "1.3.1", "1.3.2", "1.4.0", "1.4.1", "1.5.0", "1.6.0",
    "1.7.0", "1.8.0",
  ], ["enkelvoudiginformatieobjecten", "gebruiksrechten"]),
  zgw("zgw-catalogi", "Catalogi API", "catalogi", [
    "1.0.0", "1.0.1", "1.1.0", "1.2.0", "1.3.0", "1.3.1", "1.3.2", "1.3.3", "1.4.0",
  ], ["catalogussen", "zaaktypen"]),
  zgw("zgw-besluiten", "Besluiten API", "besluiten", ["1.0.0", "1.0.1", "1.0.2", "1.1.0"], [
    "besluiten", "besluitinformatieobjecten",
  ]),
  zgw("zgw-notificaties", "Notificaties API", "notificaties", ["1.0.0", "1.0.1", "1.1.0"], ["kanaal", "notificaties"]),
  zgw("zgw-autorisaties", "Autorisaties API", "autorisaties", ["1.0.0", "1.0.1", "1.1.0"], ["applicaties"]),
  {
    id: "api-design-rules",
    name: "NL API Design Rules",
    uriTemplate: "https://gitdocumentatie.logius.nl/publicatie/api/adr/{version}/",
    versions: ["1.0", "2.0.0", "2.0.1", "2.0.2", "2.1.0", "2.2.0", "2.2.1", "2.2.2"],
    source: {
      title: "Forum Standaardisatie, REST-API Design Rules",
      url: "https://www.forumstandaardisatie.nl/open-standaarden/rest-api-design-rules",
    },
  },
  digikoppeling("digikoppeling-rest-api", "Digikoppeling REST-API", "restapi", [
    "1.0.0", "1.1.0", "2.0.0", "3.0.0", "4.0.0", "4.0.1",
  ]),
  digikoppeling("digikoppeling-wus", "Digikoppeling WUS", "wus", ["3.8.1"]),
  digikoppeling("digikoppeling-ebms2", "Digikoppeling ebMS2", "ebms", ["3.3.1", "3.3.2"]),
  digikoppeling("digikoppeling-grote-berichten", "Digikoppeling Grote Berichten", "gb", ["3.8.1"]),
  {
    id: "stuf",
    name: "StUF",
    // The XML namespace of the StUF 03.01 onderlaag (stuf0301.xsd); a namespace, not a web page.
    uriTemplate: "http://www.egem.nl/StUF/StUF{version}",
    versions: ["0301"],
    source: { title: "VNG Realisatie, StUF 03.01", url: "https://vng-realisatie.github.io/StUF-onderlaag/301-familie" },
  },
  {
    id: "brp-personen",
    name: "BRP API Personen",
    group: "Haal Centraal",
    uriTemplate: null,
    versions: [],
    openApiTitles: ["BRP API Personen"],
    source: { title: "RvIG, BRP API Personen", url: "https://developer.rvig.nl/brp-api/personen/specificatie/" },
  },
  {
    id: "objects-api",
    name: "Objects API",
    uriTemplate: null,
    versions: [],
    openApiTitles: ["Objects API"],
    source: { title: "Maykin Media, Open Object", url: "https://github.com/maykinmedia/open-object" },
  },
  {
    id: "objecttypes-api",
    name: "Objecttypes API",
    uriTemplate: null,
    versions: [],
    openApiTitles: ["Objecttypes API"],
    source: { title: "Maykin Media, Objecttypes API", url: "https://github.com/maykinmedia/objecttypes-api" },
  },
];

/** The aliases of the publiccode.yml standard's alias list that the reference parser accepts. */
export const PUBLICCODE_ALIASES: Record<string, string> = {
  gdpr: "GDPR (AVG)",
  eidas: "eIDAS",
  nis2: "NIS2",
  cra: "Cyber Resilience Act",
  spid: "SPID",
  cie: "CIE",
  anpr: "ANPR",
  pagopa: "pagoPA",
  io: "IO app",
};

/** A component declares its Common Ground layer as a `supports` id `<this URI>#<layer>`; the 5-layer check reads it. */
export const COMMON_GROUND_LAYER_URI = "https://commonground.nl/cms/view/54476261/5-lagen-model";
const COMMON_GROUND_LAYER_PREFIX = `${COMMON_GROUND_LAYER_URI}#`;

export type DeclaredStandard =
  /** A version of a standard in the registry */
  | { kind: "known"; id: string; family: StandardFamily; version: string }
  /** A standard in the registry, in a version the registry does not list yet */
  | { kind: "unlisted-version"; id: string; family: StandardFamily; version: string }
  | { kind: "alias"; id: string; name: string }
  | { kind: "layer"; id: string; layer: string }
  | { kind: "unknown"; id: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Scheme and host are case-insensitive in a URI; the path and fragment are not. */
function normaliseUri(value: string): string {
  const match = value.trim().match(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i);
  return match ? match[1].toLowerCase() + match[2] : value.trim();
}

function templatePattern(template: string): RegExp {
  const [before, after] = normaliseUri(template).split("{version}");
  return new RegExp(`^${escapeRegExp(before)}([0-9][0-9A-Za-z.-]*)${escapeRegExp(after ?? "")}$`);
}

const PATTERNS = STANDARD_FAMILIES.filter((family) => family.uriTemplate).map((family) => ({
  family,
  pattern: templatePattern(family.uriTemplate as string),
}));

/** The URI that declares `version` of a standard; null when the standard has no agreed per-version URI. */
export function standardUri(family: StandardFamily, version: string): string | null {
  return family.uriTemplate ? family.uriTemplate.replace("{version}", version) : null;
}

/** What one `supports` id declares. */
export function resolveSupportsId(id: string): DeclaredStandard {
  const value = id.trim();
  if (value.startsWith("alias:")) {
    const alias = value.slice("alias:".length).toLowerCase();
    return PUBLICCODE_ALIASES[alias] ? { kind: "alias", id: value, name: PUBLICCODE_ALIASES[alias] } : { kind: "unknown", id: value };
  }
  if (value.startsWith(COMMON_GROUND_LAYER_PREFIX)) {
    return { kind: "layer", id: value, layer: value.slice(COMMON_GROUND_LAYER_PREFIX.length) };
  }
  const normalised = normaliseUri(value);
  for (const { family, pattern } of PATTERNS) {
    const version = normalised.match(pattern)?.[1];
    if (version) {
      return { kind: family.versions.includes(version) ? "known" : "unlisted-version", id: value, family, version };
    }
  }
  return { kind: "unknown", id: value };
}

/** The `id` of every `supports` entry of a parsed publiccode.yml, in order, without duplicates. */
export function readSupportsIds(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const supports = (parsed as Record<string, unknown>).supports;
  if (!Array.isArray(supports)) return [];
  const ids = supports
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>).id : null))
    .filter((id): id is string => typeof id === "string" && id.trim() !== "")
    .map((id) => id.trim());
  return [...new Set(ids)];
}

/** "Zaken API 1.5.1", "GDPR (AVG)", or the id itself for an unknown entry. */
export function describeDeclaredStandard(declared: DeclaredStandard): string {
  switch (declared.kind) {
    case "known":
      return `${declared.family.name} ${declared.version}`;
    case "unlisted-version":
      return `${declared.family.name} ${declared.version} (version not in the registry)`;
    case "alias":
      return declared.name;
    case "layer":
      return `Common Ground layer: ${declared.layer}`;
    default:
      return declared.id;
  }
}

/** An API specification found in the repository that implements a standard in the registry. */
export interface FoundStandard {
  family: StandardFamily;
  /** `info.version` of the file; for a specification matched by its paths, the implementation may number it its own way */
  version: string | null;
  file: string;
  /** Matched by the official `info.title`, or by the standard's top-level resources */
  method: "title" | "paths";
}

/**
 * The top-level resources of an OpenAPI document: the first path segment after a version
 * segment such as `v1`, else the first segment. `/api/v1/zaken/{uuid}` gives `zaken`.
 */
export function openApiResources(paths: unknown): Set<string> {
  const resources = new Set<string>();
  if (!paths || typeof paths !== "object" || Array.isArray(paths)) return resources;
  for (const path of Object.keys(paths)) {
    const segments = path.split("/").filter(Boolean);
    const versionAt = segments.map((segment) => /^v\d+$/i.test(segment)).lastIndexOf(true);
    const resource = segments[versionAt + 1];
    if (resource && !resource.startsWith("{")) resources.add(resource.toLowerCase());
  }
  return resources;
}

/**
 * The standards an OpenAPI document implements: the one whose official `info.title` it has,
 * else every standard whose top-level resources it has. The version is `info.version`.
 */
export function matchOpenApiDocument(parsed: unknown, file: string): FoundStandard[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const document = parsed as Record<string, unknown>;
  const info = document.info && typeof document.info === "object" && !Array.isArray(document.info)
    ? (document.info as Record<string, unknown>)
    : {};
  const versionText =
    typeof info.version === "string" || typeof info.version === "number" ? String(info.version).trim() : "";
  const version = versionText || null;

  const wanted = typeof info.title === "string" ? info.title.trim().toLowerCase() : "";
  const byTitle = STANDARD_FAMILIES.find((candidate) =>
    (candidate.openApiTitles ?? []).some((known) => known.toLowerCase() === wanted)
  );
  if (byTitle) return [{ family: byTitle, version, file, method: "title" }];

  const resources = openApiResources(document.paths);
  return STANDARD_FAMILIES.filter(
    (candidate) =>
      (candidate.openApiResources ?? []).length > 0 &&
      (candidate.openApiResources ?? []).every((resource) => resources.has(resource))
  ).map((family) => ({ family, version, file, method: "paths" as const }));
}

export interface StandardsCrossCheck {
  /** Declared, and an OpenAPI file of the same standard and version is in the repository */
  declaredAndFound: Array<{ declared: DeclaredStandard; found: FoundStandard }>;
  /** Declared API standards without an OpenAPI file of that version in the repository */
  declaredNotFound: DeclaredStandard[];
  /** OpenAPI files of a known standard that publiccode.yml does not declare in that version */
  foundNotDeclared: FoundStandard[];
}

/**
 * Compares the declared standards with the OpenAPI files found. Only standards the
 * registry can recognise in an OpenAPI file take part; the others cannot be checked this way.
 */
export function crossCheckStandards(declared: DeclaredStandard[], found: FoundStandard[]): StandardsCrossCheck {
  const versioned = declared.filter(
    (item): item is Extract<DeclaredStandard, { family: StandardFamily }> =>
      (item.kind === "known" || item.kind === "unlisted-version") && (item.family.openApiTitles ?? []).length > 0
  );
  const sameVersion = (item: (typeof versioned)[number], spec: FoundStandard) =>
    spec.family.id === item.family.id && spec.version === item.version;

  const declaredAndFound = versioned.flatMap((item) => {
    const spec = found.find((candidate) => sameVersion(item, candidate));
    return spec ? [{ declared: item as DeclaredStandard, found: spec }] : [];
  });
  return {
    declaredAndFound,
    declaredNotFound: versioned.filter((item) => !found.some((spec) => sameVersion(item, spec))),
    foundNotDeclared: found.filter((spec) => !versioned.some((item) => sameVersion(item, spec))),
  };
}
