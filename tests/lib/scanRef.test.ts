import { describe, expect, it, vi } from "vitest";
import {
  findVersionTag,
  formatScanned,
  normalizeRequestedRef,
  pickLatestStableRelease,
  pickNewestStableSemverTag,
  resolveScanRef,
  ScanRefError,
} from "@/lib/scanRef";
import type { RepoContext, RepositoryProvider, RepositoryRelease } from "@/lib/providers/types";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function contextWith(options: {
  commits?: Record<string, string>;
  releases?: RepositoryRelease[] | Error;
  tags?: string[] | Error;
  files?: Record<string, string>;
}): RepoContext {
  const provider = {
    getFileContent: vi.fn(async (_context: RepoContext, path: string) => options.files?.[path] ?? null),
    getCommitSha: vi.fn(async (_context: RepoContext, ref: string) => options.commits?.[ref] ?? null),
    listReleases: vi.fn(async () => {
      if (options.releases instanceof Error) throw options.releases;
      return options.releases ?? [];
    }),
    listTags: vi.fn(async () => {
      if (options.tags instanceof Error) throw options.tags;
      return options.tags ?? [];
    }),
  } as unknown as RepositoryProvider;
  return {
    owner: "org",
    repo: "repo",
    projectPath: "org/repo",
    repoUrl: "https://github.com/org/repo",
    provider,
  };
}

function release(tag: string, publishedAt: string, extra: Partial<RepositoryRelease> = {}) {
  return { tag, draft: false, prerelease: false, publishedAt, ...extra };
}

describe("normalizeRequestedRef", () => {
  it("reads a missing, empty or blank value as the default branch", () => {
    expect(normalizeRequestedRef(undefined)).toBeNull();
    expect(normalizeRequestedRef(null)).toBeNull();
    expect(normalizeRequestedRef("  ")).toBeNull();
  });

  it("accepts latest-release, default-branch and branch or tag names", () => {
    expect(normalizeRequestedRef("latest-release")).toBe("latest-release");
    expect(normalizeRequestedRef("default-branch")).toBe("default-branch");
    expect(normalizeRequestedRef(" development ")).toBe("development");
    expect(normalizeRequestedRef("release/2.x")).toBe("release/2.x");
  });

  it("rejects values git does not allow as a ref name", () => {
    for (const value of ["two words", "a..b", "-x", "x/", "x.lock", "a//b", "x@{1}", "a:b", 7]) {
      expect(normalizeRequestedRef(value), String(value)).toBeUndefined();
    }
  });
});

describe("pickNewestStableSemverTag", () => {
  it("picks the highest stable semver tag and skips pre-releases and other tags", () => {
    expect(
      pickNewestStableSemverTag(["v1.9.0", "v1.10.0", "v2.0.0-rc.1", "latest", "1.2.3", "v1.10.0-beta"])
    ).toBe("v1.10.0");
  });

  it("returns null without a stable semver tag", () => {
    expect(pickNewestStableSemverTag(["nightly", "v1.0.0-alpha"])).toBeNull();
  });
});

describe("pickLatestStableRelease", () => {
  it("picks the newest published release that is not a draft or pre-release", () => {
    expect(
      pickLatestStableRelease([
        release("v3.0.0", "2026-11-01T00:00:00Z", { draft: true }),
        release("v2.1.0", "2026-10-20T00:00:00Z", { prerelease: true }),
        release("v2.1.0-rc.1", "2026-10-15T00:00:00Z"),
        release("v2.0.0", "2026-10-01T00:00:00Z"),
        release("v1.9.0", "2026-09-01T00:00:00Z"),
      ])
    ).toBe("v2.0.0");
  });
});

describe("resolveScanRef without a requested ref", () => {
  it("1. scans the tag of the publiccode.yml softwareVersion, matching with a leading v", async () => {
    const context = contextWith({
      files: { "publiccode.yml": 'publiccodeYmlVersion: "0.2"\nsoftwareVersion: "1.2.2"\n' },
      tags: ["v1.3.0", "v1.2.2", "v1.2.1"],
      releases: [release("v1.3.0", "2026-11-01T00:00:00Z")],
      commits: { "v1.2.2": SHA },
    });

    await expect(resolveScanRef(context, "main", null)).resolves.toEqual({
      ref: "v1.2.2",
      kind: "declared-version",
      commit: SHA,
    });
  });

  it("1. matches a declared v-version to a tag without the v, and reads publiccode.yaml", async () => {
    const context = contextWith({
      files: { "publiccode.yaml": "softwareVersion: v1.31.0 # current\n" },
      tags: ["1.31.2", "1.31.0"],
      commits: { "1.31.0": SHA },
    });

    await expect(resolveScanRef(context, "main", null)).resolves.toMatchObject({
      ref: "1.31.0",
      kind: "declared-version",
    });
  });

  it("2. scans the newest stable release when no tag matches the declared version", async () => {
    const context = contextWith({
      files: { "publiccode.yml": "softwareVersion: 2.0.0\n" },
      tags: ["v1.0.0", "v1.1.0"],
      releases: [release("v1.1.0", "2026-11-01T00:00:00Z"), release("v1.0.0", "2026-10-01T00:00:00Z")],
      commits: { "v1.1.0": SHA },
    });

    await expect(resolveScanRef(context, "main", null)).resolves.toEqual({
      ref: "v1.1.0",
      kind: "release",
      commit: SHA,
    });
  });

  it("2. scans the newest stable semver tag without publiccode.yml or a release", async () => {
    const context = contextWith({ tags: ["v1.2.7-unstable.1", "v1.2.2", "v1.2.0"], commits: { "v1.2.2": SHA } });

    await expect(resolveScanRef(context, "main", null)).resolves.toEqual({
      ref: "v1.2.2",
      kind: "tag",
      commit: SHA,
    });
  });

  it("3. falls back to the default branch with a warning when nothing is released", async () => {
    const context = contextWith({
      files: { "publiccode.yml": "softwareVersion: 0.1.4\n" },
      tags: ["nightly"],
      releases: new Error("GitHub API 404"),
      commits: { main: SHA },
    });

    const resolved = await resolveScanRef(context, "main", null);

    expect(resolved).toMatchObject({ ref: "main", kind: "default-branch-fallback", commit: SHA });
    expect(resolved.warning).toBe(
      "No tag matches the publiccode.yml softwareVersion 0.1.4 and no stable release or semver tag was found, so the default branch main was scanned instead of a released version."
    );
  });
});

describe("resolveScanRef with a requested ref", () => {
  it("scans the default branch for default-branch, ignoring the declared version", async () => {
    const context = contextWith({
      commits: { main: SHA },
      files: { "publiccode.yml": "softwareVersion: 1.0.0\n" },
      tags: ["1.0.0"],
    });

    await expect(resolveScanRef(context, "main", "default-branch")).resolves.toEqual({
      ref: "main",
      kind: "default-branch",
      commit: SHA,
    });
  });

  it("keeps scanning the default branch when its commit cannot be read", async () => {
    const context = contextWith({});
    (context.provider.getCommitSha as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("GitHub API 500")
    );

    await expect(resolveScanRef(context, "main", "default-branch")).resolves.toEqual({
      ref: "main",
      kind: "default-branch",
      commit: null,
    });
  });

  it("scans a named branch or tag at its commit", async () => {
    const context = contextWith({ commits: { development: SHA, "v1.0.0": SHA }, tags: ["v1.0.0"] });

    await expect(resolveScanRef(context, "main", "development")).resolves.toEqual({
      ref: "development",
      kind: "branch",
      commit: SHA,
    });
    await expect(resolveScanRef(context, "main", "v1.0.0")).resolves.toMatchObject({
      ref: "v1.0.0",
      kind: "branch",
    });
  });

  it("throws a ScanRefError for a branch or tag that does not exist", async () => {
    const context = contextWith({});

    await expect(resolveScanRef(context, "main", "nope")).rejects.toBeInstanceOf(ScanRefError);
    await expect(resolveScanRef(context, "main", "nope")).rejects.toThrow(
      'Branch or tag "nope" was not found in org/repo.'
    );
  });

  it("scans the newest stable release for latest-release, ignoring the declared version", async () => {
    const context = contextWith({
      commits: { "v1.2.0": SHA },
      files: { "publiccode.yml": "softwareVersion: 1.1.0\n" },
      releases: [
        release("v1.3.0-rc.1", "2026-11-10T00:00:00Z"),
        release("v1.2.0", "2026-11-01T00:00:00Z"),
        release("v1.1.0", "2026-10-01T00:00:00Z"),
      ],
      tags: ["v1.1.0", "v9.9.9"],
    });

    await expect(resolveScanRef(context, "main", "latest-release")).resolves.toEqual({
      ref: "v1.2.0",
      kind: "release",
      commit: SHA,
    });
  });

  it("falls back to the newest semver tag for latest-release when there is no release", async () => {
    const context = contextWith({
      commits: { "2.4.1": SHA },
      releases: new Error("GitHub API 404"),
      tags: ["2.3.0", "2.4.1", "2.5.0-beta.1"],
    });

    await expect(resolveScanRef(context, "main", "latest-release")).resolves.toEqual({
      ref: "2.4.1",
      kind: "tag",
      commit: SHA,
    });
  });

  it("falls back to the default branch with a warning for latest-release without a release or tag", async () => {
    const context = contextWith({ commits: { development: SHA }, tags: ["nightly"] });

    const resolved = await resolveScanRef(context, "development", "latest-release");

    expect(resolved).toMatchObject({
      ref: "development",
      kind: "default-branch-fallback",
      commit: SHA,
    });
    expect(resolved.warning).toBe(
      "No stable release or semver tag was found, so the default branch development was scanned instead of the latest release."
    );
  });
});

describe("findVersionTag", () => {
  it("prefers the exact tag and matches with or without a leading v", () => {
    expect(findVersionTag(["v1.2.2", "1.2.2"], "1.2.2")).toBe("1.2.2");
    expect(findVersionTag(["v1.2.2"], "1.2.2")).toBe("v1.2.2");
    expect(findVersionTag(["1.2.2"], "v1.2.2")).toBe("1.2.2");
    expect(findVersionTag(["v1.2.20"], "1.2.2")).toBeNull();
  });
});

describe("formatScanned", () => {
  it("says why the ref was chosen, with the short commit", () => {
    expect(formatScanned("v1.2.2", "declared-version", SHA)).toBe("declared version v1.2.2 @ 0123456");
    expect(formatScanned("v1.2.0", "release", SHA)).toBe("latest release v1.2.0 @ 0123456");
    expect(formatScanned("v1.2.0", "tag", null)).toBe("newest tag v1.2.0");
    expect(formatScanned("development", "branch", SHA)).toBe("development @ 0123456");
    expect(formatScanned("main", "default-branch", SHA)).toBe("main (default branch) @ 0123456");
    expect(formatScanned("main", "default-branch-fallback", null)).toBe(
      "main (default branch, no release found)"
    );
  });
});
