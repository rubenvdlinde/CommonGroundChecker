import yaml from "js-yaml";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { findPubliccodeFile } from "./publiccode";
import { findOpenApiFiles } from "./openapi";
import {
  crossCheckStandards,
  describeDeclaredStandard,
  matchOpenApiDocument,
  readSupportsIds,
  resolveSupportsId,
  type DeclaredStandard,
  type FoundStandard,
} from "../standards";

/** OpenAPI files read per scan; a monorepo can hold hundreds of copies of the same specification. */
const MAX_OPENAPI_FILES = 25;

const BASE = {
  id: "standards",
  title: "Supported standards",
  description:
    "The standards and versions the component declares in publiccode.yml under supports, compared with the OpenAPI files in the repository. Informative: it does not count in any rating.",
  referenceUrl: "https://publiccodeyml.github.io/v0/schema.core.html#key-supports",
} as const;

function parseYaml(content: string | null): unknown {
  if (!content) return null;
  try {
    return yaml.load(content);
  } catch {
    return null;
  }
}

function foundLabel(found: FoundStandard): string {
  return `${found.family.name} ${found.version ?? "(no version)"} in ${found.file} (by ${found.method})`;
}

async function readFoundStandards(
  context: RepoContext,
  tree: string[],
  apiSpecificationLocations: string[]
): Promise<FoundStandard[]> {
  const inTree = new Map(tree.map((path) => [path.toLowerCase(), path]));
  const provided = apiSpecificationLocations
    .map((location) => location.trim().replace(/^\/+|\/+$/g, ""))
    .filter((location) => location && !/^https?:\/\//i.test(location))
    .map((location) => inTree.get(location.toLowerCase()))
    .filter((path): path is string => !!path);
  const files = [...new Set([...provided, ...findOpenApiFiles(tree)])].slice(0, MAX_OPENAPI_FILES);

  const found: FoundStandard[] = [];
  for (const file of files) {
    for (const match of matchOpenApiDocument(parseYaml(await context.provider.getFileContent(context, file)), file)) {
      if (!found.some((other) => other.family.id === match.family.id && other.version === match.version)) {
        found.push(match);
      }
    }
  }
  return found;
}

/** Lists the standards publiccode.yml declares under `supports` and compares them with the OpenAPI files found. */
export async function checkStandards(
  context: RepoContext,
  tree: string[],
  apiSpecificationLocations: string[] = []
): Promise<CheckResult> {
  const file = findPubliccodeFile(tree);
  const parsed = file ? parseYaml(await context.provider.getFileContent(context, file)) : null;
  const declared: DeclaredStandard[] = readSupportsIds(parsed).map(resolveSupportsId);
  const found = await readFoundStandards(context, tree, apiSpecificationLocations);
  const cross = crossCheckStandards(declared, found);

  const standards = declared.filter((item) => item.kind !== "layer");
  const unknown = standards.filter((item) => item.kind === "unknown");
  const evidence = [
    ...standards.map((item) =>
      item.kind === "unknown" ? `Not in the registry: ${item.id}` : `Declared: ${describeDeclaredStandard(item)} (${item.id})`
    ),
    ...cross.declaredAndFound.map((pair) => `Declared and found: ${foundLabel(pair.found)}`),
    ...cross.declaredNotFound.map((item) => `Declared, not found in the repository: ${describeDeclaredStandard(item)}`),
    ...cross.foundNotDeclared.map((item) => `Found in the repository, not declared: ${foundLabel(item)}`),
  ];

  const where = file ?? "publiccode.yml";
  const sentences = [
    !file
      ? "No publiccode.yml found, so no standards are declared."
      : standards.length === 0
        ? `${where} declares no standards under supports.`
        : `${where} declares ${standards.length} ${standards.length === 1 ? "standard" : "standards"}: ${standards
            .map(describeDeclaredStandard)
            .join(", ")}.`,
    unknown.length > 0 ? `${unknown.length} not in the registry of known standards.` : null,
    found.length > 0 || cross.declaredNotFound.length > 0
      ? `OpenAPI cross-check: ${cross.declaredAndFound.length} declared and found, ${cross.declaredNotFound.length} declared but not found in the repository, ${cross.foundNotDeclared.length} found in the repository but not declared.`
      : null,
  ].filter(Boolean);

  return { ...BASE, status: "info", message: sentences.join(" "), evidence };
}
