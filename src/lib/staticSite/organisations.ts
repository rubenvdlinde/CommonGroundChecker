/**
 * Organisations that use followed components, grouped from the declared
 * users (publiccode.yml `usedBy`) of each repository's latest analysis.
 * Same grouping, slugs and near-duplicate rules as the backend
 * (src/lib/organisations.ts there), so both modes give the same pages.
 */
import { organisationKey } from "@/lib/organisations";

export interface DeclaringRepository {
  repoId: string;
  declaredUsers: string[] | null;
}

export interface OrganisationGroup {
  key: string;
  name: string;
  slug: string;
  spellings: string[];
  repoIds: string[];
}

export interface NearDuplicate {
  names: string[];
  slugs: string[];
}

const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

function withoutAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function mixedCase(value: string): boolean {
  return value !== value.toLowerCase() && value !== value.toUpperCase();
}

export function organisationSlug(name: string): string {
  const slug = withoutAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "organisation";
}

export function aggregateOrganisations(repositories: DeclaringRepository[]): OrganisationGroup[] {
  const groups = new Map<string, { spellings: Map<string, number>; repoIds: string[] }>();
  for (const repository of repositories) {
    const seen = new Set<string>();
    for (const raw of repository.declaredUsers ?? []) {
      const spelling = raw.trim().replace(/\s+/g, " ");
      const key = organisationKey(spelling);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) ?? { spellings: new Map<string, number>(), repoIds: [] };
      group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
      group.repoIds.push(repository.repoId);
      groups.set(key, group);
    }
  }

  const named = [...groups.entries()].map(([key, group]) => {
    const spellings = [...group.spellings.entries()]
      .sort((a, b) => b[1] - a[1] || Number(mixedCase(b[0])) - Number(mixedCase(a[0])))
      .map(([spelling]) => spelling);
    return { key, name: spellings[0], spellings, repoIds: group.repoIds };
  });
  named.sort((a, b) => collator.compare(a.name, b.name) || a.key.localeCompare(b.key));

  const used = new Set<string>();
  return named.map((group) => {
    const base = organisationSlug(group.name);
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return { ...group, slug };
  });
}

const PREFIXES = [
  "gemeente",
  "municipality of",
  "city of",
  "provincie",
  "province of",
  "waterschap",
  "hoogheemraadschap",
  "ministerie van",
  "ministry of",
];

export function looseOrganisationKey(name: string): string {
  let key = withoutAccents(organisationKey(name))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const prefix of PREFIXES) {
    if (key.startsWith(`${prefix} `)) {
      key = key.slice(prefix.length + 1);
      break;
    }
  }
  return key.replace(/\s+/g, "");
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const TYPO_MIN_LENGTH = 6;

export function findNearDuplicates(groups: OrganisationGroup[]): NearDuplicate[] {
  const keys = groups.map((group) => looseOrganisationKey(group.name));
  const parent = groups.map((_, index) => index);
  const root = (index: number): number => (parent[index] === index ? index : (parent[index] = root(parent[index])));

  for (let a = 0; a < groups.length; a += 1) {
    for (let b = a + 1; b < groups.length; b += 1) {
      if (!keys[a] || !keys[b]) continue;
      const similar =
        keys[a] === keys[b] ||
        (Math.min(keys[a].length, keys[b].length) >= TYPO_MIN_LENGTH && withinOneEdit(keys[a], keys[b]));
      if (similar) parent[root(b)] = root(a);
    }
  }

  const clusters = new Map<number, OrganisationGroup[]>();
  groups.forEach((group, index) => clusters.set(root(index), [...(clusters.get(root(index)) ?? []), group]));
  return [...clusters.values()]
    .filter((members) => members.length > 1)
    .map((members) => ({ names: members.map((member) => member.name), slugs: members.map((member) => member.slug) }));
}
