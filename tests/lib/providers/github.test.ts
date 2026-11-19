import { describe, expect, it } from "vitest";
import { GitHubRepositoryProvider } from "@/lib/providers/github";

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
