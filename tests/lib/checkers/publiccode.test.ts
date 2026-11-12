import { describe, expect, it, vi } from "vitest";
import { checkPublicCode } from "@/lib/checkers/publiccode";
import type { RepoContext } from "@/lib/providers/types";

function contextWith(content: string): RepoContext {
  return {
    owner: "org",
    repo: "repo",
    projectPath: "org/repo",
    repoUrl: "https://github.com/org/repo",
    provider: { getFileContent: vi.fn().mockResolvedValue(content) },
  } as unknown as RepoContext;
}

const REQUIRED = `publiccodeYmlVersion: "0.4"
name: Example
url: "https://github.com/org/repo"
legal:
  license: EUPL-1.2
maintenance:
  type: internal
categories:
  - document-management
`;

describe("checkPublicCode", () => {
  it("passes with a Dutch description and no country section", async () => {
    const content = `${REQUIRED}description:\n  nl:\n    shortDescription: "Voorbeeld"\n`;

    const result = await checkPublicCode(contextWith(content), ["publiccode.yml"]);

    expect(result.status).toBe("pass");
  });

  it("warns about a missing Dutch description", async () => {
    const content = `${REQUIRED}description:\n  en:\n    shortDescription: "Example"\n`;

    const result = await checkPublicCode(contextWith(content), ["publiccode.yml"]);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("description.nl");
  });

  it("does not ask for the deprecated nl country section", async () => {
    const content = `${REQUIRED}description:\n  nl:\n    shortDescription: "Voorbeeld"\n`;

    const result = await checkPublicCode(contextWith(content), ["publiccode.yml"]);

    expect(result.message).not.toMatch(/missing: .*\bnl\b/);
  });

  it("fails without a publiccode.yml", async () => {
    const result = await checkPublicCode(contextWith(""), ["README.md"]);

    expect(result.status).toBe("fail");
  });
});
