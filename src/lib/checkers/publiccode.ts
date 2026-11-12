import yaml from "js-yaml";
import type { CheckResult, PublicCodeDetails } from "../types";
import type { RepoContext } from "../providers/types";

const REQUIRED_FIELDS = ["publiccodeYmlVersion", "name", "url", "legal"];
// Dotted paths. A Dutch description stands in for the top-level `nl:` country section,
// which the standard deprecates (it only defines `IT:`).
const RECOMMENDED_FIELDS = ["description", "maintenance", "categories", "description.nl"];

function hasField(parsed: Record<string, unknown>, field: string): boolean {
  let node: unknown = parsed;
  for (const key of field.split(".")) {
    if (typeof node !== "object" || node === null || !(key in node)) return false;
    node = (node as Record<string, unknown>)[key];
  }
  return true;
}

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

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:" ? value : null;
    } catch {
      return null;
    }
  }

  const path = value.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  const segments = path.split("/");
  if (!path || segments.some((segment) => segment === ".." || segment === ".")) return null;
  return context.provider.getRawFileUrl(context, branch, path);
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

/** Checks publiccode.yml and returns the repository details it declares. */
export async function analysePublicCode(
  context: RepoContext,
  tree: string[]
): Promise<PublicCodeAnalysis> {
  const isPubliccodeFile = (path: string) => {
    const lower = path.toLowerCase().replace(/^\/+|\/+$/g, "");
    const filename = lower.split("/").pop() ?? lower;
    return filename === "publiccode.yml" || filename === "publiccode.yaml";
  };

  const rootMatch = tree.find((p) => {
    const lower = p.toLowerCase().replace(/^\/+|\/+$/g, "");
    return lower === "publiccode.yml" || lower === "publiccode.yaml";
  });
  const fallbackMatch = tree.find(isPubliccodeFile);
  const file = rootMatch ?? fallbackMatch;

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

  const details = extractPublicCodeDetails(parsed, context, context.defaultBranch ?? "main");
  const missingRequired = REQUIRED_FIELDS.filter((f) => !(f in parsed));
  const missingRecommended = RECOMMENDED_FIELDS.filter((f) => !hasField(parsed, f));

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
    },
    details,
  };
}
