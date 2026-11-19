import type { RepoContext } from "./providers/types";

/** The requested ref that scans the newest stable release instead of a branch. */
export const LATEST_RELEASE_REF = "latest-release";

/** The requested ref that always scans the default branch. */
export const DEFAULT_BRANCH_REF = "default-branch";

/**
 * Why the scanned ref was chosen:
 * - `declared-version`: the tag matching publiccode.yml `softwareVersion`;
 * - `release`: the newest stable release;
 * - `tag`: the newest stable semver tag, when there is no release;
 * - `branch`: a branch or tag named in the request;
 * - `default-branch`: the default branch, because it was asked for;
 * - `default-branch-fallback`: the default branch, because no release was found.
 */
export type ScanRefKind =
  | "declared-version"
  | "release"
  | "tag"
  | "branch"
  | "default-branch"
  | "default-branch-fallback";

export const SCAN_REF_KINDS: ScanRefKind[] = [
  "declared-version",
  "release",
  "tag",
  "branch",
  "default-branch",
  "default-branch-fallback",
];

export interface ResolvedScanRef {
  /** Branch or tag name that is scanned. */
  ref: string;
  kind: ScanRefKind;
  /** Commit SHA the ref pointed at, or null when the provider did not return one. */
  commit: string | null;
  /** Set when the requested ref could not be used as asked. */
  warning?: string;
}

/** A requested branch or tag that is invalid or does not exist; the scan does not start. */
export class ScanRefError extends Error {}

/**
 * Reads a requested ref. An empty or missing value lets the checker choose
 * (see resolveScanRef) and is returned as null; otherwise the value is
 * `default-branch`, `latest-release` or a branch or tag name that follows
 * git's ref-name rules. Returns `undefined` for any other value.
 */
export function normalizeRequestedRef(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === LATEST_RELEASE_REF || trimmed === DEFAULT_BRANCH_REF) return trimmed;
  const valid =
    trimmed.length <= 255 &&
    !/[\s~^:?*[\\\x00-\x1f\x7f]/.test(trimmed) &&
    !trimmed.includes("..") &&
    !trimmed.includes("@{") &&
    !trimmed.includes("//") &&
    !/^[-/.]|[/.]$|\.lock$|\/\./.test(trimmed);
  return valid ? trimmed : undefined;
}

const STABLE_SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/i;

/** Whether a tag is a stable semantic version: `1.2.3` or `v1.2.3`, no pre-release suffix. */
export function isStableSemverTag(tag: string): boolean {
  return STABLE_SEMVER.test(tag.trim());
}

/** The highest stable semver tag, or null when there is none. */
export function pickNewestStableSemverTag(tags: string[]): string | null {
  const parsed = tags
    .map((tag) => tag.trim())
    .map((tag) => ({ tag, match: tag.match(STABLE_SEMVER) }))
    .filter((entry): entry is { tag: string; match: RegExpMatchArray } => entry.match !== null)
    .map(({ tag, match }) => ({
      tag,
      parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    }));
  parsed.sort((a, b) => {
    for (let i = 0; i < 3; i += 1) {
      if (a.parts[i] !== b.parts[i]) return b.parts[i] - a.parts[i];
    }
    return 0;
  });
  return parsed[0]?.tag ?? null;
}

/**
 * The tag of the newest published stable release. Drafts, releases marked
 * as pre-release and tags with a pre-release suffix (`-rc.1`) are skipped.
 */
export function pickLatestStableRelease(
  releases: Array<{ tag: string; draft: boolean; prerelease: boolean; publishedAt: string | null }>
): string | null {
  const stable = releases
    .filter((release) => release.tag && !release.draft && !release.prerelease)
    .filter((release) => !/^v?\d+\.\d+\.\d+-/.test(release.tag));
  stable.sort(
    (a, b) => Date.parse(b.publishedAt ?? "1970-01-01") - Date.parse(a.publishedAt ?? "1970-01-01")
  );
  return stable[0]?.tag ?? null;
}

async function commitOrNull(context: RepoContext, ref: string): Promise<string | null> {
  try {
    return await context.provider.getCommitSha(context, ref);
  } catch {
    return null;
  }
}

async function orEmpty<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch {
    return [];
  }
}

const PUBLICCODE_FILES = ["publiccode.yml", "publiccode.yaml"];

/** The `softwareVersion` that publiccode.yml declares on the default branch, or null. */
export async function readDeclaredVersion(context: RepoContext): Promise<string | null> {
  for (const file of PUBLICCODE_FILES) {
    let content: string | null = null;
    try {
      content = await context.provider.getFileContent(context, file);
    } catch {
      content = null;
    }
    if (!content) continue;
    const match = content.match(/^softwareVersion:[ \t]*["']?([^"'\s#]+)/m);
    return match?.[1] ?? null;
  }
  return null;
}

/** The tag that names a version, with or without a leading "v". */
export function findVersionTag(tags: string[], version: string): string | null {
  const bare = version.replace(/^v/i, "");
  return tags.find((tag) => tag === version) ?? tags.find((tag) => tag.replace(/^v/i, "") === bare) ?? null;
}

async function latestReleaseOrTag(context: RepoContext, tags: string[] | null) {
  const release = pickLatestStableRelease(await orEmpty(() => context.provider.listReleases(context)));
  if (release) return { ref: release, kind: "release" as const };
  const tag = pickNewestStableSemverTag(tags ?? (await orEmpty(() => context.provider.listTags(context))));
  if (tag) return { ref: tag, kind: "tag" as const };
  return null;
}

async function fallBackToDefaultBranch(
  context: RepoContext,
  defaultBranch: string,
  warning: string
): Promise<ResolvedScanRef> {
  return {
    ref: defaultBranch,
    kind: "default-branch-fallback",
    commit: await commitOrNull(context, defaultBranch),
    warning,
  };
}

/**
 * Works out which ref a check scans and the commit it points at.
 *
 * - no ref: the tag matching publiccode.yml `softwareVersion` on the default
 *   branch, else the newest stable release, else the newest stable semver
 *   tag, else the default branch with a warning;
 * - `default-branch`: the default branch;
 * - `latest-release`: the newest stable release, else the newest stable
 *   semver tag, else the default branch with a warning;
 * - a branch or tag name: that ref, or a ScanRefError when it does not exist.
 *
 * `context.defaultBranch` must be set and `context.ref` unset, so file reads
 * come from the default branch.
 */
export async function resolveScanRef(
  context: RepoContext,
  defaultBranch: string,
  requested: string | null
): Promise<ResolvedScanRef> {
  const { provider } = context;

  if (requested === DEFAULT_BRANCH_REF) {
    return {
      ref: defaultBranch,
      kind: "default-branch",
      commit: await commitOrNull(context, defaultBranch),
    };
  }

  if (!requested) {
    const tags = await orEmpty(() => provider.listTags(context));
    const declared = await readDeclaredVersion(context);
    const declaredTag = declared ? findVersionTag(tags, declared) : null;
    if (declaredTag) {
      return {
        ref: declaredTag,
        kind: "declared-version",
        commit: await commitOrNull(context, declaredTag),
      };
    }

    const released = await latestReleaseOrTag(context, tags);
    if (released) return { ...released, commit: await commitOrNull(context, released.ref) };

    return fallBackToDefaultBranch(
      context,
      defaultBranch,
      `No tag matches the publiccode.yml softwareVersion${declared ? ` ${declared}` : ""} and no stable release or semver tag was found, so the default branch ${defaultBranch} was scanned instead of a released version.`
    );
  }

  if (requested === LATEST_RELEASE_REF) {
    const released = await latestReleaseOrTag(context, null);
    if (released) return { ...released, commit: await commitOrNull(context, released.ref) };

    return fallBackToDefaultBranch(
      context,
      defaultBranch,
      `No stable release or semver tag was found, so the default branch ${defaultBranch} was scanned instead of the latest release.`
    );
  }

  const commit = await provider.getCommitSha(context, requested);
  if (!commit) {
    throw new ScanRefError(
      `Branch or tag "${requested}" was not found in ${context.projectPath}.`
    );
  }
  return { ref: requested, kind: "branch", commit };
}

/**
 * How a scanned ref reads on a page, with why it was chosen: for example
 * `declared version v1.2.2`, `latest release v1.2.0` or `main (default
 * branch, no release found)`.
 */
export function formatScannedRef(ref: string, kind: ScanRefKind | null | undefined): string {
  if (kind === "declared-version") return `declared version ${ref}`;
  if (kind === "release") return `latest release ${ref}`;
  if (kind === "tag") return `newest tag ${ref}`;
  if (kind === "default-branch") return `${ref} (default branch)`;
  if (kind === "default-branch-fallback") return `${ref} (default branch, no release found)`;
  return ref;
}

/** "development @ abc1234", or just the ref when the commit is unknown. */
export function formatScanned(
  ref: string,
  kind: ScanRefKind | null | undefined,
  commit: string | null | undefined
): string {
  const label = formatScannedRef(ref, kind);
  return commit ? `${label} @ ${commit.slice(0, 7)}` : label;
}
