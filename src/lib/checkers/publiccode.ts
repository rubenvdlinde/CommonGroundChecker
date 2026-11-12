import yaml from "js-yaml";
import type { CheckResult } from "../types";
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

export async function checkPublicCode(
  context: RepoContext,
  tree: string[]
): Promise<CheckResult> {
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
      id: "publiccode",
      title: "publiccode.yml Metadata File",
      description:
        "A publiccode.yml file must be present in the repository root, containing machine-readable metadata per the publiccode.yml standard.",
      status: "fail",
      message:
        "No publiccode.yml file found. This file is mandatory for reuse in the Dutch public sector.",
      evidence: [],
      referenceUrl: "https://standard.publiccode.net/criteria/",
    };
  }

  const content = await context.provider.getFileContent(context, file);
  if (!content) {
    return {
      id: "publiccode",
      title: "publiccode.yml Metadata File",
      description:
        "A publiccode.yml file must be present in the repository root.",
      status: "warn",
      message: `Found ${file} but could not read its contents.`,
      evidence: [file],
      referenceUrl: "https://standard.publiccode.net/criteria/",
    };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = (yaml.load(content) as Record<string, unknown>) ?? {};
  } catch {
    return {
      id: "publiccode",
      title: "publiccode.yml Metadata File",
      description:
        "A publiccode.yml file must be present in the repository root.",
      status: "fail",
      message: `Found ${file} but it is not valid YAML.`,
      evidence: [file],
      referenceUrl: "https://standard.publiccode.net/criteria/",
    };
  }

  const missingRequired = REQUIRED_FIELDS.filter((f) => !(f in parsed));
  const missingRecommended = RECOMMENDED_FIELDS.filter((f) => !hasField(parsed, f));

  if (missingRequired.length > 0) {
    return {
      id: "publiccode",
      title: "publiccode.yml Metadata File",
      description:
        "A publiccode.yml file must be present in the repository root.",
      status: "warn",
      message: `publiccode.yml found but is missing required fields: ${missingRequired.join(", ")}.`,
      evidence: [file],
      referenceUrl: "https://standard.publiccode.net/criteria/",
    };
  }

  const msg =
    missingRecommended.length > 0
      ? `publiccode.yml is valid. Recommended fields missing: ${missingRecommended.join(", ")}.`
      : "publiccode.yml is present and contains all required and recommended fields.";

  return {
    id: "publiccode",
    title: "publiccode.yml Metadata File",
    description:
      "A publiccode.yml file must be present in the repository root.",
    status: missingRecommended.length > 0 ? "warn" : "pass",
    message: msg,
    evidence: [file],
    referenceUrl: "https://standard.publiccode.net/criteria/",
  };
}
