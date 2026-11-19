/**
 * The standards of one component, read from the "Supported standards" result
 * (src/lib/checkers/standards.ts): what publiccode.yml declares under
 * `supports` and what the OpenAPI files in the repository implement.
 */
import { STANDARD_FAMILIES, resolveSupportsId } from "./standards";

export interface ComponentStandard {
  /** The registry id of the standard, or the declared id for a standard not in the registry */
  id: string;
  name: string;
  /** Versions declared or found, in the order first seen */
  versions: string[];
  /** Declared in publiccode.yml */
  declared: boolean;
  /** Found in an OpenAPI file in the repository */
  found: boolean;
  /** In the registry of src/lib/standards.ts */
  known: boolean;
}

const DECLARED = /^Declared: .* \((.+)\)$/;
const NOT_IN_REGISTRY = /^Not in the registry: (.+)$/;
const FOUND = /^(?:Declared and found|Found in the repository, not declared): (.+) in \S.* \(by (?:title|paths)\)$/;

/** Longest name first, so "Objecttypes API" is not read as "Objects API". */
const FAMILIES_BY_NAME = [...STANDARD_FAMILIES].sort((a, b) => b.name.length - a.name.length);

function familyOfFound(label: string): { id: string; name: string; version: string | null } | null {
  const family = FAMILIES_BY_NAME.find((item) => label === item.name || label.startsWith(`${item.name} `));
  if (!family) return null;
  const version = label.slice(family.name.length).trim();
  return { id: family.id, name: family.name, version: version && version !== "(no version)" ? version : null };
}

/**
 * The standards in the evidence of a "Supported standards" result; null when
 * there is no result, so "not measured" stays apart from "none".
 * Common Ground layer declarations are not standards and are left out.
 */
export function standardsFromEvidence(evidence: string[] | null | undefined): ComponentStandard[] | null {
  if (!Array.isArray(evidence)) return null;
  const byId = new Map<string, ComponentStandard>();
  const add = (id: string, name: string, version: string | null, how: "declared" | "found", known: boolean) => {
    const entry = byId.get(id) ?? { id, name, versions: [], declared: false, found: false, known };
    if (version && !entry.versions.includes(version)) entry.versions.push(version);
    entry[how] = true;
    byId.set(id, entry);
  };
  for (const line of evidence) {
    const declared = line.match(DECLARED);
    if (declared) {
      const standard = resolveSupportsId(declared[1]);
      if (standard.kind === "known" || standard.kind === "unlisted-version") {
        add(standard.family.id, standard.family.name, standard.version, "declared", true);
      } else if (standard.kind === "alias") {
        add(standard.id, standard.name, null, "declared", true);
      }
      continue;
    }
    const unknown = line.match(NOT_IN_REGISTRY);
    if (unknown) {
      add(unknown[1], unknown[1], null, "declared", false);
      continue;
    }
    const found = line.match(FOUND);
    const family = found ? familyOfFound(found[1]) : null;
    if (family) add(family.id, family.name, family.version, "found", true);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The standards of an analysis from its results; null when it has no "Supported standards" result. */
export function standardsOfResults(results: Array<{ id: string; evidence?: string[] }> | null | undefined): ComponentStandard[] | null {
  const result = (results ?? []).find((item) => item.id === "standards");
  return result ? standardsFromEvidence(result.evidence ?? []) : null;
}

/** The standards the Components list can filter on: every standard in the registry. */
export const STANDARD_FILTER_OPTIONS: ReadonlyArray<{ id: string; name: string }> = STANDARD_FAMILIES.map((family) => ({
  id: family.id,
  name: family.name,
})).sort((a, b) => a.name.localeCompare(b.name));

/** "Zaken API 1.5.1, declared and found". */
export function describeComponentStandard(standard: ComponentStandard): string {
  const how =
    standard.declared && standard.found
      ? "declared and found"
      : standard.declared
        ? "declared in publiccode.yml"
        : "found in an OpenAPI file";
  return `${standard.name}${standard.versions.length ? ` ${standard.versions.join(", ")}` : ""}, ${how}`;
}
