import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubRepositoryProvider } from "@/lib/providers/github";
import type { RepoContext } from "@/lib/providers/types";

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
