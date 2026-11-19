import yaml from "js-yaml";
import type {
  CheckResult,
  PublicCodeData,
  PublicCodeDependency,
  PublicCodeDescription,
  PublicCodeDetails,
  PublicCodeParty,
} from "../types";
import type { RepoContext } from "../providers/types";
import { readSupportsIds } from "../standards";

const REQUIRED_FIELDS = ["publiccodeYmlVersion", "name", "url", "legal"];
const RECOMMENDED_FIELDS = ["description", "maintenance", "categories", "nl"];

export interface PublicCodeAnalysis {
  result: CheckResult;
  details: PublicCodeDetails;
}

export const EMPTY_PUBLICCODE_DETAILS: PublicCodeDetails = {
  displayName: null,
  shortDescription: null,
  logoUrl: null,
  developmentStatus: null,
  maintenanceType: null,
  maintainers: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function namesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (isRecord(item) ? optionalString(item.name) : null))
    .filter((name): name is string => name !== null);
}

/** Picks the Dutch short description, else the English one, else the first language that has one. */
function pickShortDescription(description: unknown): string | null {
  if (!isRecord(description)) return null;
  const languages = Object.keys(description);
  const preferred = ["nl", "en"].flatMap((code) =>
    languages.filter((lang) => lang.toLowerCase() === code || lang.toLowerCase().startsWith(`${code}-`))
  );
  for (const lang of [...preferred, ...languages]) {
    const entry = description[lang];
    const shortDescription = isRecord(entry) ? optionalString(entry.shortDescription) : null;
    if (shortDescription) return shortDescription;
  }
  return null;
}

/**
 * Resolves publiccode.yml's `logo` to an absolute http(s) URL. A repository path is served
 * through the git host's raw URL for the branch; other schemes and paths that leave the
 * repository are rejected.
 */
export function resolveLogoUrl(logo: unknown, context: RepoContext, branch: string): string | null {
  const value = optionalString(logo);
  if (!value || value.startsWith("//") || value.includes("\\")) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return absoluteUrl(value);

  const path = value.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  const segments = path.split("/");
  if (!path || segments.some((segment) => segment === ".." || segment === ".")) return null;
  return context.provider.getRawFileUrl(context, branch, path);
}

/** A scalar as text: YAML dates (which js-yaml turns into a Date) as YYYY-MM-DD, numbers as written. */
function text(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return optionalString(value);
}

function texts(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return items.map(text).filter((item): item is string => item !== null);
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function party(value: Record<string, unknown>): PublicCodeParty {
  return { name: text(value.name), uri: text(value.uri) };
}

function dependencies(value: unknown): PublicCodeDependency[] {
  return records(value).map((dependency) => ({
    name: text(dependency.name),
    versionMin: text(dependency.versionMin),
    versionMax: text(dependency.versionMax),
    version: text(dependency.version),
    optional: flag(dependency.optional),
  }));
}

/**
 * Reads every field of publiccode.yml into a normalised shape. `resolveUrl` turns the
 * logo and screenshot paths into absolute URLs; without it only http(s) URLs are kept.
 * Also reads a shape stored earlier, so a stored scan is shown the same way.
 */
export function readPublicCodeData(
  parsed: unknown,
  resolveUrl: (value: unknown) => string | null = absoluteUrl
): PublicCodeData | null {
  if (!isRecord(parsed)) return null;

  const record = (value: unknown) => (isRecord(value) ? value : {});
  const audience = record(parsed.intendedAudience);
  const legal = record(parsed.legal);
  const maintenance = record(parsed.maintenance);
  const localisation = record(parsed.localisation);
  const dependsOn = record(parsed.dependsOn);
  const urls = (value: unknown) =>
    (Array.isArray(value) ? value : []).map(resolveUrl).filter((url): url is string => url !== null);

  const descriptionEntries: [string, Record<string, unknown>][] = Array.isArray(parsed.descriptions)
    ? records(parsed.descriptions).map((entry) => [text(entry.language) ?? "", entry])
    : Object.entries(record(parsed.description)).filter(
        (entry): entry is [string, Record<string, unknown>] => isRecord(entry[1])
      );
  const descriptions: PublicCodeDescription[] = descriptionEntries.map(([language, entry]) => ({
    language,
    localisedName: text(entry.localisedName),
    genericName: text(entry.genericName),
    shortDescription: text(entry.shortDescription),
    longDescription: text(entry.longDescription),
    documentation: text(entry.documentation),
    apiDocumentation: text(entry.apiDocumentation),
    features: texts(entry.features),
    screenshots: urls(entry.screenshots),
    videos: texts(entry.videos),
    awards: texts(entry.awards),
  }));

  return {
    publiccodeYmlVersion: text(parsed.publiccodeYmlVersion),
    name: text(parsed.name),
    applicationSuite: text(parsed.applicationSuite),
    url: text(parsed.url),
    landingURL: text(parsed.landingURL),
    isBasedOn: texts(parsed.isBasedOn),
    softwareVersion: text(parsed.softwareVersion),
    releaseDate: text(parsed.releaseDate),
    logo: resolveUrl(parsed.logo),
    platforms: texts(parsed.platforms),
    categories: texts(parsed.categories),
    usedBy: texts(parsed.usedBy),
    roadmap: text(parsed.roadmap),
    developmentStatus: text(parsed.developmentStatus),
    softwareType: text(parsed.softwareType),
    // A stored shape keeps the ids as strings.
    supports: (Array.isArray(parsed.supports) ? parsed.supports : []).every((item) => typeof item === "string")
      ? texts(parsed.supports)
      : readSupportsIds(parsed),
    intendedAudience: {
      countries: texts(audience.countries),
      unsupportedCountries: texts(audience.unsupportedCountries),
      scope: texts(audience.scope),
    },
    descriptions,
    legal: {
      license: text(legal.license),
      mainCopyrightOwner: text(legal.mainCopyrightOwner),
      repoOwner: text(legal.repoOwner),
      authorsFile: text(legal.authorsFile),
    },
    maintenance: {
      type: text(maintenance.type),
      contractors: records(maintenance.contractors).map((contractor) => ({
        name: text(contractor.name),
        until: text(contractor.until),
        email: text(contractor.email),
        website: text(contractor.website),
      })),
      contacts: records(maintenance.contacts).map((contact) => ({
        name: text(contact.name),
        email: text(contact.email),
        phone: text(contact.phone),
        affiliation: text(contact.affiliation),
      })),
    },
    localisation: {
      localisationReady: flag(localisation.localisationReady),
      availableLanguages: texts(localisation.availableLanguages),
    },
    dependsOn: {
      open: dependencies(dependsOn.open),
      proprietary: dependencies(dependsOn.proprietary),
      hardware: dependencies(dependsOn.hardware),
    },
    organisation: isRecord(parsed.organisation) ? party(parsed.organisation) : null,
    fundedBy: records(parsed.fundedBy).map(party),
  };
}

/** An absolute http(s) URL as is; anything else is dropped. */
function absoluteUrl(value: unknown): string | null {
  const url = optionalString(value);
  if (!url) return null;
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function extractPublicCodeDetails(
  parsed: unknown,
  context: RepoContext,
  branch: string
): PublicCodeDetails {
  if (!isRecord(parsed)) return EMPTY_PUBLICCODE_DETAILS;

  const maintenance = isRecord(parsed.maintenance) ? parsed.maintenance : {};
  const contacts = namesOf(maintenance.contacts);
  const organisation = isRecord(parsed.organisation) ? optionalString(parsed.organisation.name) : null;
  const organisations = [
    ...namesOf(maintenance.contractors),
    ...(organisation ? [organisation] : []),
  ];

  return {
    displayName: optionalString(parsed.name),
    shortDescription: pickShortDescription(parsed.description),
    logoUrl: resolveLogoUrl(parsed.logo, context, branch),
    developmentStatus: optionalString(parsed.developmentStatus),
    maintenanceType: optionalString(maintenance.type),
    maintainers: [...new Set(contacts.length > 0 ? contacts : organisations)],
  };
}

/** The repository's publiccode.yml: the one in the root, else the first one found deeper in the tree. */
export function findPubliccodeFile(tree: string[]): string | undefined {
  const isPubliccodeFile = (path: string) => {
    const lower = path.toLowerCase().replace(/^\/+|\/+$/g, "");
    const filename = lower.split("/").pop() ?? lower;
    return filename === "publiccode.yml" || filename === "publiccode.yaml";
  };

  const rootMatch = tree.find((p) => {
    const lower = p.toLowerCase().replace(/^\/+|\/+$/g, "");
    return lower === "publiccode.yml" || lower === "publiccode.yaml";
  });
  return rootMatch ?? tree.find(isPubliccodeFile);
}

/** Checks publiccode.yml and returns the repository details it declares. */
export async function analysePublicCode(
  context: RepoContext,
  tree: string[]
): Promise<PublicCodeAnalysis> {
  const file = findPubliccodeFile(tree);

  if (!file) {
    return {
      result: {
        id: "publiccode",
        title: "publiccode.yml Metadata File",
        description:
          "A publiccode.yml file must be present in the repository root, containing machine-readable metadata per the publiccode.yml standard.",
        status: "fail",
        message:
          "No publiccode.yml file found. This file is mandatory for reuse in the Dutch public sector.",
        evidence: [],
        referenceUrl: "https://standard.publiccode.net/criteria/",
      },
      details: EMPTY_PUBLICCODE_DETAILS,
    };
  }

  const content = await context.provider.getFileContent(context, file);
  if (!content) {
    return {
      result: {
        id: "publiccode",
        title: "publiccode.yml Metadata File",
        description:
          "A publiccode.yml file must be present in the repository root.",
        status: "warn",
        message: `Found ${file} but could not read its contents.`,
        evidence: [file],
        referenceUrl: "https://standard.publiccode.net/criteria/",
      },
      details: EMPTY_PUBLICCODE_DETAILS,
    };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = (yaml.load(content) as Record<string, unknown>) ?? {};
  } catch {
    return {
      result: {
        id: "publiccode",
        title: "publiccode.yml Metadata File",
        description:
          "A publiccode.yml file must be present in the repository root.",
        status: "fail",
        message: `Found ${file} but it is not valid YAML.`,
        evidence: [file],
        referenceUrl: "https://standard.publiccode.net/criteria/",
      },
      details: EMPTY_PUBLICCODE_DETAILS,
    };
  }

  const branch = context.defaultBranch ?? "main";
  const details = extractPublicCodeDetails(parsed, context, branch);
  const publiccode = readPublicCodeData(parsed, (value) => resolveLogoUrl(value, context, branch)) ?? undefined;
  const missingRequired = REQUIRED_FIELDS.filter((f) => !(f in parsed));
  const missingRecommended = RECOMMENDED_FIELDS.filter((f) => !(f in parsed));

  if (missingRequired.length > 0) {
    return {
      result: {
        id: "publiccode",
        title: "publiccode.yml Metadata File",
        description:
          "A publiccode.yml file must be present in the repository root.",
        status: "warn",
        message: `publiccode.yml found but is missing required fields: ${missingRequired.join(", ")}.`,
        evidence: [file],
        referenceUrl: "https://standard.publiccode.net/criteria/",
        publiccode,
      },
      details,
    };
  }

  const msg =
    missingRecommended.length > 0
      ? `publiccode.yml is valid. Recommended fields missing: ${missingRecommended.join(", ")}.`
      : "publiccode.yml is present and contains all required and recommended fields.";

  return {
    result: {
      id: "publiccode",
      title: "publiccode.yml Metadata File",
      description:
        "A publiccode.yml file must be present in the repository root.",
      status: missingRecommended.length > 0 ? "warn" : "pass",
      message: msg,
      evidence: [file],
      referenceUrl: "https://standard.publiccode.net/criteria/",
      publiccode,
    },
    details,
  };
}
