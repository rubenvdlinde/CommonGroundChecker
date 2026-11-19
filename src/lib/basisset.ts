/** The components of the Common Ground basisset, as VNG publishes them. */
export const BASISSET_URL =
  "https://code.overheid.nl/CommonGround/vcg-basisset/raw/branch/main/data/components.json";

/** The page of the basisset repository, for people. */
export const BASISSET_REPOSITORY_URL = "https://code.overheid.nl/CommonGround/vcg-basisset";

/** The list is read at most once a day. */
export const BASISSET_REVALIDATE_SECONDS = 24 * 60 * 60;

const FETCH_TIMEOUT_MS = 10_000;

export interface BasissetEntry {
  name: string;
  repo: string[];
  version: string | null;
  description: string;
  /** The status as the list gives it, for example "g" or "i.o." */
  status: string;
  architectureLayers: string;
  /** Whether the entry is part of the basisset; the list also names components next to it */
  basisset: boolean;
  note: string | null;
}

export interface Basisset {
  version: string | null;
  components: BasissetEntry[];
}

/** How the scanned version compares with the version in the basisset. */
export type VersionComparison = "equal" | "newer" | "older" | "unknown";

export interface BasissetEntryMatch {
  name: string;
  status: string;
  version: string | null;
  /** Whether the entry is part of the basisset, not only listed next to it */
  inBasisset: boolean;
  comparison: VersionComparison;
}

/**
 * What the basisset says about one repository. `entries` are the entries
 * whose repository URL is this one; several can share a repository.
 * `otherAddress` are entries with the same repository name at another
 * address, which may be a stale URL in the list. Information only: never
 * part of a rating, the verdict or the Common Ground status.
 */
export interface BasissetMatch {
  /** Null when the list could not be read */
  listVersion: string | null;
  available: boolean;
  entries: BasissetEntryMatch[];
  otherAddress: Array<{ name: string; repo: string }>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Reads the components document; entries without a name are left out. Null when it is not a document. */
export function parseBasisset(raw: unknown): Basisset | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { components?: unknown }).components)) return null;
  const document = raw as { version?: unknown; components: unknown[] };
  const components: BasissetEntry[] = [];
  for (const item of document.components) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name = text(entry.name);
    if (!name) continue;
    components.push({
      name,
      repo: Array.isArray(entry.repo) ? entry.repo.map(text).filter((url): url is string => url !== null) : [],
      version: text(entry.version),
      description: text(entry.description) ?? "",
      status: text(entry.status) ?? "",
      architectureLayers: text(entry.architectureLayers) ?? "",
      basisset: entry.basisset === true,
      note: text(entry.note),
    });
  }
  return { version: text(document.version), components };
}

/**
 * A repository URL in one form for comparing: lower case host and path,
 * without the scheme, `www.`, a `.git` suffix, a trailing slash, a query,
 * or a `/tree/...` or `/-/tree/...` path into a branch.
 */
export function normaliseRepoUrl(url: string): string {
  let value = url.trim().toLowerCase();
  value = value.replace(/^[a-z+]+:\/\//, "").replace(/^git@([^:]+):/, "$1/");
  value = value.replace(/[?#].*$/, "");
  value = value.replace(/^www\./, "");
  value = value.replace(/\/(?:-\/)?(?:tree|blob|src)\/.*$/, "");
  value = value.replace(/\/+$/, "").replace(/\.git$/, "").replace(/\/+$/, "");
  return value;
}

/** The last path segment of a normalised URL: the repository name. */
function repositoryName(normalised: string): string {
  return normalised.slice(normalised.lastIndexOf("/") + 1);
}

interface ParsedVersion {
  numbers: number[];
  prerelease: string[];
}

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/i.exec(value.trim());
  if (!match) return null;
  return {
    numbers: match[1].split(".").map(Number),
    prerelease: match[2] ? match[2].split(".") : [],
  };
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 0 : a.length === 0 ? 1 : -1;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    const numberA = /^\d+$/.test(a[index]) ? Number(a[index]) : null;
    const numberB = /^\d+$/.test(b[index]) ? Number(b[index]) : null;
    if (numberA !== null && numberB !== null) {
      if (numberA !== numberB) return numberA < numberB ? -1 : 1;
    } else if (numberA !== null || numberB !== null) {
      return numberA !== null ? -1 : 1;
    } else if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Compares two versions by semver precedence, tolerating a leading `v` and
 * fewer or more than three numbers (missing numbers count as 0). Returns
 * -1, 0 or 1, or null when either is not a version.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let index = 0; index < Math.max(left.numbers.length, right.numbers.length); index += 1) {
    const x = left.numbers[index] ?? 0;
    const y = right.numbers[index] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  const pre = comparePrerelease(left.prerelease, right.prerelease);
  return pre === 0 ? 0 : pre < 0 ? -1 : 1;
}

/** How a scanned version compares with the basisset's: newer, older, equal or unknown. */
export function compareWithBasisset(scanned: string | null, listed: string | null): VersionComparison {
  if (!scanned || !listed) return "unknown";
  const order = compareVersions(scanned, listed);
  if (order === null) return "unknown";
  return order === 0 ? "equal" : order > 0 ? "newer" : "older";
}

/** What the basisset says about a repository, compared with the scanned version. */
export function matchBasisset(
  basisset: Basisset | null,
  repoUrl: string,
  scannedVersion: string | null
): BasissetMatch {
  if (!basisset) return { listVersion: null, available: false, entries: [], otherAddress: [] };
  const target = normaliseRepoUrl(repoUrl);
  const entries: BasissetEntryMatch[] = [];
  const otherAddress: BasissetMatch["otherAddress"] = [];
  for (const entry of basisset.components) {
    const urls = entry.repo.map(normaliseRepoUrl);
    if (urls.includes(target)) {
      entries.push({
        name: entry.name,
        status: entry.status,
        version: entry.version,
        inBasisset: entry.basisset,
        comparison: compareWithBasisset(scannedVersion, entry.version),
      });
      continue;
    }
    const sameName = entry.repo.find((url) => repositoryName(normaliseRepoUrl(url)) === repositoryName(target));
    if (sameName) otherAddress.push({ name: entry.name, repo: sameName });
  }
  return { listVersion: basisset.version, available: true, entries, otherAddress };
}

/** Whether a repository is part of the basisset: at least one entry with its URL is in the basisset itself. */
export function isInBasisset(match: BasissetMatch | null | undefined): boolean {
  return Boolean(match?.entries.some((entry) => entry.inBasisset));
}

/**
 * Reads the basisset, cached for a day by Next.js. `BASISSET_URL` in the
 * environment points elsewhere, for example a local copy. Returns null when
 * the list cannot be read in time; the checker then says so.
 */
export async function loadBasisset(
  url: string = process.env.BASISSET_URL?.trim() || BASISSET_URL,
  fetchFn: typeof fetch = fetch
): Promise<Basisset | null> {
  try {
    const response = await fetchFn(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: BASISSET_REVALIDATE_SECONDS },
    } as RequestInit);
    if (!response.ok) return null;
    return parseBasisset(await response.json());
  } catch {
    return null;
  }
}

const COMPARISON_TEXT: Record<Exclude<VersionComparison, "unknown">, string> = {
  equal: "the same as",
  newer: "newer than",
  older: "older than",
};

/** "In the Common Ground basisset as Open Zaak (g), version 1.29.0", or "Listed next to the basisset as ..." */
export function describeBasissetEntry(entry: Pick<BasissetEntryMatch, "name" | "status" | "version" | "inBasisset">): string {
  const lead = entry.inBasisset ? "In the Common Ground basisset as" : "Listed next to the basisset as";
  const status = entry.status ? ` (${entry.status})` : "";
  const version = entry.version ? `, version ${entry.version}` : ", no version given";
  return `${lead} ${entry.name}${status}${version}`;
}

/** "The scanned version 1.31.2 is newer than the basisset's 1.29.0", or null when they cannot be compared. */
export function describeVersionComparison(
  scanned: string | null,
  entry: Pick<BasissetEntryMatch, "version" | "comparison">
): string | null {
  if (entry.comparison === "unknown" || !scanned || !entry.version) return null;
  return `The scanned version ${scanned} is ${COMPARISON_TEXT[entry.comparison]} the basisset's ${entry.version}`;
}

/** A repository the checker knows, as the basisset overview matches it. */
export interface CheckedRepository {
  owner: string;
  name: string;
  repoUrl: string;
  /** The scanned version of the latest analysis, or null */
  version: string | null;
}

/** One basisset entry with the repositories the checker has for it. */
export interface BasissetOverviewRow {
  entry: BasissetEntry;
  /** Repositories in the checker at one of the entry's addresses */
  matches: Array<CheckedRepository & { comparison: VersionComparison }>;
  /** Repositories in the checker with the same repository name at another address */
  otherAddress: CheckedRepository[];
}

/** Every basisset entry, in the list's order, with the checker's repositories at its addresses or under its name. */
export function basissetOverview(basisset: Basisset, repositories: CheckedRepository[]): BasissetOverviewRow[] {
  const checked = repositories.map((repository) => ({ repository, url: normaliseRepoUrl(repository.repoUrl) }));
  return basisset.components.map((entry) => {
    const urls = entry.repo.map(normaliseRepoUrl);
    const names = new Set(urls.map(repositoryName));
    const matches: BasissetOverviewRow["matches"] = [];
    const otherAddress: CheckedRepository[] = [];
    for (const { repository, url } of checked) {
      if (urls.includes(url)) {
        matches.push({ ...repository, comparison: compareWithBasisset(repository.version, entry.version) });
      } else if (names.has(repositoryName(url))) {
        otherAddress.push(repository);
      }
    }
    return { entry, matches, otherAddress };
  });
}
