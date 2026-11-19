import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubRepositoryProvider } from "@/lib/providers/github";
import type { RepoContext } from "@/lib/providers/types";

describe("GitHubRepositoryProvider", () => {
  it("builds the raw file URL for a branch and path", () => {
    expect(
      GitHubRepositoryProvider.getRawFileUrl(
        {
          owner: "open-zaak",
          repo: "open-zaak",
          projectPath: "open-zaak/open-zaak",
          repoUrl: "https://github.com/open-zaak/open-zaak",
          defaultBranch: "main",
          provider: GitHubRepositoryProvider,
        },
        "main",
        "docs/logo#1.svg"
      )
    ).toBe("https://raw.githubusercontent.com/open-zaak/open-zaak/main/docs/logo%231.svg");
  });
});

function contextFor(defaultBranch?: string): RepoContext {
  return {
    owner: "org",
    repo: "repo",
    projectPath: "org/repo",
    repoUrl: "https://github.com/org/repo",
    defaultBranch,
    provider: GitHubRepositoryProvider,
  };
}

function stubFetch() {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({ encoding: "base64", content: Buffer.from("hello").toString("base64") }),
      { status: 200 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GitHubRepositoryProvider.getFileContent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads file contents from the same ref as the tree", async () => {
    const fetchMock = stubFetch();

    const content = await GitHubRepositoryProvider.getFileContent(
      contextFor("feature/x"),
      "README.md"
    );

    expect(content).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/contents/README.md?ref=feature%2Fx",
      expect.anything()
    );
  });

  it("falls back to the default branch when the context has no ref", async () => {
    const fetchMock = stubFetch();

    await GitHubRepositoryProvider.getFileContent(contextFor(), "README.md");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/contents/README.md",
      expect.anything()
    );
  });
});

describe("GitHubRepositoryProvider scan refs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads file contents from the scan ref before the default branch", async () => {
    const fetchMock = stubFetch();

    await GitHubRepositoryProvider.getFileContent(
      { ...contextFor("main"), ref: "0123456789abcdef0123456789abcdef01234567" },
      "publiccode.yml"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/contents/publiccode.yml?ref=0123456789abcdef0123456789abcdef01234567",
      expect.anything()
    );
  });

  it("reads the commit SHA of a ref as plain text", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const fetchMock = vi.fn(async () => new Response(`${sha}\n`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      GitHubRepositoryProvider.getCommitSha(contextFor("main"), "release/2.x")
    ).resolves.toBe(sha);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/org/repo/commits/release%2F2.x");
    expect((init.headers as Record<string, string>).Accept).toBe("application/vnd.github.sha");
  });

  it("returns null for a ref GitHub does not know and throws on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    await expect(GitHubRepositoryProvider.getCommitSha(contextFor(), "nope")).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limit exceeded", { status: 403 })));
    await expect(GitHubRepositoryProvider.getCommitSha(contextFor(), "main")).rejects.toThrow(
      "GitHub API 403"
    );
  });

  it("lists releases with their draft and pre-release flags, and tag names", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes("/releases")
            ? [
                { tag_name: "v1.1.0-rc.1", draft: false, prerelease: true, published_at: "2026-11-02T00:00:00Z" },
                { tag_name: "v1.0.0", draft: false, prerelease: false, published_at: "2026-11-01T00:00:00Z" },
              ]
            : [{ name: "v1.1.0-rc.1" }, { name: "v1.0.0" }]
        ),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(GitHubRepositoryProvider.listReleases(contextFor())).resolves.toEqual([
      { tag: "v1.1.0-rc.1", draft: false, prerelease: true, publishedAt: "2026-11-02T00:00:00Z" },
      { tag: "v1.0.0", draft: false, prerelease: false, publishedAt: "2026-11-01T00:00:00Z" },
    ]);
    await expect(GitHubRepositoryProvider.listTags(contextFor())).resolves.toEqual([
      "v1.1.0-rc.1",
      "v1.0.0",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/releases?per_page=100",
      expect.anything()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/org/repo/tags?per_page=100&page=1",
      expect.anything()
    );
  });
});

describe("GitHubRepositoryProvider.listTags", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads further pages, so stable tags behind 100 nightly tags are found, up to 10 pages", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      const names =
        page === 1
          ? Array.from({ length: 100 }, (_, i) => `v1.3.0-unstable.${i}`)
          : page === 2
          ? ["v1.2.2", "v1.2.0"]
          : [];
      return new Response(JSON.stringify(names.map((name) => ({ name }))), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const tags = await GitHubRepositoryProvider.listTags(contextFor());

    expect(tags).toHaveLength(102);
    expect(tags.slice(-2)).toEqual(["v1.2.2", "v1.2.0"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ name: `n${i}` }))), {
        status: 200,
      })
    );
    await GitHubRepositoryProvider.listTags(contextFor());
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
