import { afterEach, describe, expect, it, vi } from "vitest";
import { GitLabRepositoryProvider } from "@/lib/providers/gitlab";
import { getSupportedProviders, resolveRepositoryContext } from "@/lib/providers";

describe("GitLabRepositoryProvider", () => {
  it("parses a GitLab repository URL", () => {
    expect(
      GitLabRepositoryProvider.parseRepoUrl("https://gitlab.com/group/subgroup/project")
    ).toEqual({
      owner: "group",
      repo: "project",
      projectPath: "group/subgroup/project",
    });
  });

  it("builds the correct clone URL", () => {
    expect(
      GitLabRepositoryProvider.getCloneUrl({
        owner: "group",
        repo: "project",
        projectPath: "group/subgroup/project",
        repoUrl: "https://gitlab.com/group/subgroup/project",
        defaultBranch: "main",
        provider: GitLabRepositoryProvider,
      })
    ).toBe("https://gitlab.com/group/subgroup/project.git");
  });

  it("builds the raw file URL for a branch and path", () => {
    expect(
      GitLabRepositoryProvider.getRawFileUrl(
        {
          owner: "group",
          repo: "project",
          projectPath: "group/subgroup/project",
          repoUrl: "https://gitlab.com/group/subgroup/project",
          defaultBranch: "main",
          provider: GitLabRepositoryProvider,
        },
        "feature/logo",
        "docs/my logo.svg"
      )
    ).toBe("https://gitlab.com/group/subgroup/project/-/raw/feature/logo/docs/my%20logo.svg");
  });
});

describe("provider registry", () => {
  it("supports GitLab URLs through resolveRepositoryContext", () => {
    const context = resolveRepositoryContext("https://gitlab.com/group/project");

    expect(context).toEqual(
      expect.objectContaining({
        provider: GitLabRepositoryProvider,
        owner: "group",
        repo: "project",
        projectPath: "group/project",
        repoUrl: "https://gitlab.com/group/project",
      })
    );
  });

  it("includes gitlab in the supported provider list", () => {
    expect(getSupportedProviders()).toEqual(expect.arrayContaining(["gitlab.com"]));
  });
});

describe("GitLabRepositoryProvider.getFileContent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads file contents from the same ref as the tree", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ encoding: "base64", content: Buffer.from("hello").toString("base64") }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const content = await GitLabRepositoryProvider.getFileContent(
      {
        owner: "group",
        repo: "project",
        projectPath: "group/project",
        repoUrl: "https://gitlab.com/group/project",
        defaultBranch: "feature/x",
        provider: GitLabRepositoryProvider,
      },
      "README.md"
    );

    expect(content).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/group%2Fproject/repository/files/README.md?ref=feature%2Fx",
      expect.anything()
    );
  });
});

describe("GitLabRepositoryProvider scan refs", () => {
  const context = {
    owner: "group",
    repo: "project",
    projectPath: "group/project",
    repoUrl: "https://gitlab.com/group/project",
    defaultBranch: "main",
    provider: GitLabRepositoryProvider,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads file contents from the scan ref before the default branch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ encoding: "base64", content: "" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await GitLabRepositoryProvider.getFileContent({ ...context, ref: "abc123" }, "README.md");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/group%2Fproject/repository/files/README.md?ref=abc123",
      expect.anything()
    );
  });

  it("reads the commit SHA of a ref and returns null for an unknown ref", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "0123456789abcdef0123456789abcdef01234567" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(GitLabRepositoryProvider.getCommitSha(context, "release/2.x")).resolves.toBe(
      "0123456789abcdef0123456789abcdef01234567"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/group%2Fproject/repository/commits/release%2F2.x",
      expect.anything()
    );

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    await expect(GitLabRepositoryProvider.getCommitSha(context, "nope")).resolves.toBeNull();
  });

  it("lists releases, treating an upcoming release as a pre-release, and tag names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("/releases")
              ? [
                  { tag_name: "v2.0.0", upcoming_release: true, released_at: "2026-12-01T00:00:00Z" },
                  { tag_name: "v1.0.0", upcoming_release: false, released_at: "2026-11-01T00:00:00Z" },
                ]
              : [{ name: "v1.0.0" }]
          ),
          { status: 200 }
        )
      )
    );

    await expect(GitLabRepositoryProvider.listReleases(context)).resolves.toEqual([
      { tag: "v2.0.0", draft: false, prerelease: true, publishedAt: "2026-12-01T00:00:00Z" },
      { tag: "v1.0.0", draft: false, prerelease: false, publishedAt: "2026-11-01T00:00:00Z" },
    ]);
    await expect(GitLabRepositoryProvider.listTags(context)).resolves.toEqual(["v1.0.0"]);
  });

  it("reads further tag pages", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      const names = page === 1 ? Array.from({ length: 100 }, (_, i) => `nightly-${i}`) : ["v1.0.0"];
      return new Response(JSON.stringify(names.map((name) => ({ name }))), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const tags = await GitLabRepositoryProvider.listTags(context);

    expect(tags).toHaveLength(101);
    expect(tags[100]).toBe("v1.0.0");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
