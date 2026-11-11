import yaml from "js-yaml";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";

const SBOM_EXACT_FILES = [
  "sbom.json",
  "sbom.xml",
  "sbom.yaml",
  "sbom.yml",
  "sbom.spdx",
  "sbom.spdx.json",
  "sbom.cdx.json",
  "bom.json",
  "bom.xml",
  "bom.yaml",
  "bom.yml",
  "cyclonedx.json",
  "cyclonedx.xml",
  "spdx.json",
  "spdx.yaml",
  "spdx.yml",
];

// File name conventions of the SBOM standards:
// CycloneDX: https://cyclonedx.org/specification/overview/ (bom.json, bom.xml, *.cdx.json, *.cdx.xml)
// SPDX: https://spdx.github.io/spdx-spec/v2.3.1/conformance/ (*.spdx, *.spdx.json, *.spdx.yaml, ...)
const SBOM_EXTENSIONS = [
  ".cdx.json",
  ".cdx.xml",
  ".spdx",
  ".spdx.json",
  ".spdx.yaml",
  ".spdx.yml",
  ".spdx.xml",
  ".spdx.rdf",
];

// Directories whose files describe something other than the component itself.
const EXCLUDED_DIRECTORY = /(?:^|\/)(?:node_modules|vendor|tests?|__tests__|fixtures?|__fixtures__|testdata)\//;

// Directories conventionally holding SBOMs; files there still need SBOM content.
const SBOM_DIRECTORY = /(?:^|\/)(?:sbom|cyclonedx)\//;

const MAX_CONTENT_CHECKS = 10;

function hasSbomFileName(lowerPath: string): boolean {
  const filename = lowerPath.split("/").pop() ?? lowerPath;
  return (
    SBOM_EXACT_FILES.includes(filename) ||
    SBOM_EXTENSIONS.some((extension) => filename.endsWith(extension))
  );
}

function isSbomDocument(lowerPath: string, content: string): boolean {
  if (lowerPath.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown> | null;
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        (parsed.bomFormat === "CycloneDX" || typeof parsed.spdxVersion === "string")
      );
    } catch {
      return false;
    }
  }
  if (lowerPath.endsWith(".xml")) {
    return /<bom\b[^>]*xmlns\s*=\s*["']https?:\/\/cyclonedx\.org\/schema\/bom/i.test(content) ||
      /<spdxVersion>/i.test(content);
  }
  return false;
}

function countXmlTags(content: string, tags: string[]): number {
  return tags.reduce((count, tag) => {
    const match = content.match(new RegExp(`<${tag}\\b`, "gi"));
    return count + (match?.length ?? 0);
  }, 0);
}

function getArrayLength(obj: unknown, key: string): number | null {
  if (typeof obj !== "object" || obj === null) return null;
  const value = (obj as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : null;
}

function findDependencyCount(parsed: unknown): number | null {
  if (parsed == null) return null;
  if (Array.isArray(parsed)) return parsed.length;
  if (typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;

  const primaryCount =
    getArrayLength(obj, "components") ??
    getArrayLength(obj, "packages") ??
    getArrayLength(obj, "dependencies");
  if (primaryCount !== null) return primaryCount;

  const nestedKeys = ["bom", "spdxDocument", "spdx", "document"];
  for (const key of nestedKeys) {
    const nested = obj[key];
    const count = getArrayLength(nested, "components") ??
      getArrayLength(nested, "packages") ??
      getArrayLength(nested, "dependencies");
    if (count !== null) return count;
  }

  return null;
}

function parseSbomDependencyCount(filePath: string, content: string): number | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".spdx.json") || lower.endsWith(".cdx.json")) {
    try {
      return findDependencyCount(JSON.parse(content));
    } catch {
      return null;
    }
  }

  if (lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".spdx.yaml") || lower.endsWith(".spdx.yml")) {
    try {
      return findDependencyCount(yaml.load(content));
    } catch {
      return null;
    }
  }

  if (lower.endsWith(".xml")) {
    const xmlCount = countXmlTags(content, ["component", "package", "dependency"]);
    return xmlCount > 0 ? xmlCount : null;
  }

  if (lower.endsWith(".spdx")) {
    const match = content.match(/^PackageName:\s*[^\r\n]+/gim);
    return match?.length ?? null;
  }

  return null;
}

export async function checkSbom(
  context: RepoContext,
  tree: string[]
): Promise<CheckResult> {
  const lowerTree = tree.map((p) => p.toLowerCase());

  const found = tree.filter((_path, index) => {
    const lower = lowerTree[index];
    return !EXCLUDED_DIRECTORY.test(lower) && hasSbomFileName(lower);
  });

  if (found.length === 0) {
    const sbomDirectoryCandidates = tree
      .filter((_path, index) => {
        const lower = lowerTree[index];
        return (
          !EXCLUDED_DIRECTORY.test(lower) &&
          SBOM_DIRECTORY.test(lower) &&
          (lower.endsWith(".json") || lower.endsWith(".xml"))
        );
      })
      .slice(0, MAX_CONTENT_CHECKS);

    for (const candidate of sbomDirectoryCandidates) {
      const candidateContent = await context.provider.getFileContent(context, candidate);
      if (candidateContent && isSbomDocument(candidate.toLowerCase(), candidateContent)) {
        found.push(candidate);
      }
    }
  }

  if (found.length === 0) {
    return {
      id: "sbom",
      title: "SBOM (Software Bill of Materials)",
      description:
        "The component should publish an SBOM (e.g. SPDX or CycloneDX) to improve software supply-chain transparency.",
      status: "warn",
      message:
        "No SBOM file found. Consider publishing SPDX or CycloneDX output in the repository.",
      evidence: [],
      referenceUrl: "https://www.cisa.gov/sbom",
    };
  }

  const primarySbom = found[0];
  const content = await context.provider.getFileContent(context, primarySbom);
  const dependencyCount = content
    ? parseSbomDependencyCount(primarySbom, content)
    : null;

  const countMessage = dependencyCount !== null
    ? ` It appears to list ${dependencyCount} dependencies in ${primarySbom}.`
    : ` Could not determine dependency count from ${primarySbom}.`;

  return {
    id: "sbom",
    title: "SBOM (Software Bill of Materials)",
    description:
      "The component should publish an SBOM (e.g. SPDX or CycloneDX) to improve software supply-chain transparency.",
    status: "pass",
    message: `SBOM file(s) found: ${found.slice(0, 5).join(", ")}${found.length > 5 ? ` (+${found.length - 5} more)` : ""}.${countMessage}`,
    evidence: found.slice(0, 10),
    referenceUrl: "https://www.cisa.gov/sbom",
  };
}
