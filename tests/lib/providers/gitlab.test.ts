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
