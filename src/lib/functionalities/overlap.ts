/**
 * Overlap between components, measured on their functionalities: what two
 * components share, what only one of them does, and per functionality which
 * components provide it.
 */
import type { FunctionalityTaxonomy, ReferenceComponent, Functionality } from "./taxonomy";

export interface FunctionalityOverlap {
  shared: string[];
  onlyA: string[];
  onlyB: string[];
  /** Shared divided by every functionality of either; null when neither lists one */
  degree: number | null;
}

/** Shared, only in A, only in B, and the degree of overlap: shared / union (the Jaccard index). */
export function functionalityOverlap(a: string[], b: string[]): FunctionalityOverlap {
  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((id) => setB.has(id)).sort();
  const onlyA = [...setA].filter((id) => !setB.has(id)).sort();
  const onlyB = [...setB].filter((id) => !setA.has(id)).sort();
  const union = shared.length + onlyA.length + onlyB.length;
  return { shared, onlyA, onlyB, degree: union === 0 ? null : shared.length / union };
}

/** The degree of overlap in plain words, for the compare page. */
export function describeOverlap(overlap: FunctionalityOverlap, nameA: string, nameB: string): string {
  if (overlap.degree === null) return "Neither component lists its functionalities yet, so overlap cannot be measured.";
  const union = overlap.shared.length + overlap.onlyA.length + overlap.onlyB.length;
  const percent = Math.round(overlap.degree * 100);
  if (overlap.shared.length === 0) {
    return `${nameA} and ${nameB} share none of their ${union} functionalities. They do not overlap.`;
  }
  const lead = `${nameA} and ${nameB} share ${overlap.shared.length} of the ${union} functionalities they list together (${percent}%).`;
  if (overlap.onlyA.length === 0 && overlap.onlyB.length === 0) return `${lead} They do the same things.`;
  if (overlap.onlyA.length === 0) return `${lead} Everything ${nameA} does, ${nameB} does too.`;
  if (overlap.onlyB.length === 0) return `${lead} Everything ${nameB} does, ${nameA} does too.`;
  return `${lead} Each also does something the other does not.`;
}

/** A component on the landscape: what it is called and which functionalities it lists. */
export interface LandscapeComponent {
  owner: string;
  name: string;
  displayName: string | null;
  functionalities: string[];
  draft: boolean;
}

export type LandscapeKind = "overlap" | "single" | "gap";

export interface LandscapeEntry {
  functionality: Functionality;
  referenceComponents: ReferenceComponent[];
  components: LandscapeComponent[];
  /** More than one component: a candidate overlap. None: a gap. */
  kind: LandscapeKind;
}

export function landscapeKind(count: number): LandscapeKind {
  return count > 1 ? "overlap" : count === 1 ? "single" : "gap";
}

/** Per functionality of the taxonomy, the components that list it, in the order of the taxonomy. */
export function buildLandscape(taxonomy: FunctionalityTaxonomy, components: LandscapeComponent[]): LandscapeEntry[] {
  const byComponent = new Map<string, ReferenceComponent[]>();
  for (const reference of taxonomy.referenceComponents) {
    for (const id of reference.functionalities) byComponent.set(id, [...(byComponent.get(id) ?? []), reference]);
  }
  const sortedComponents = [...components].sort((a, b) =>
    (a.displayName ?? `${a.owner}/${a.name}`).localeCompare(b.displayName ?? `${b.owner}/${b.name}`, "en", { sensitivity: "base" })
  );
  return taxonomy.functionalities.map((functionality) => {
    const providing = sortedComponents.filter((component) => component.functionalities.includes(functionality.id));
    return {
      functionality,
      referenceComponents: byComponent.get(functionality.id) ?? [],
      components: providing,
      kind: landscapeKind(providing.length),
    };
  });
}

/** How many functionalities have overlap, one component, or none. */
export function landscapeCounts(entries: LandscapeEntry[]): Record<LandscapeKind, number> {
  const counts: Record<LandscapeKind, number> = { overlap: 0, single: 0, gap: 0 };
  for (const entry of entries) counts[entry.kind] += 1;
  return counts;
}

/** Functionality ids the taxonomy does not know; they are left out of every view. */
export function unknownFunctionalities(ids: string[], taxonomy: FunctionalityTaxonomy): string[] {
  const known = new Set(taxonomy.functionalities.map((functionality) => functionality.id));
  return ids.filter((id) => !known.has(id));
}
