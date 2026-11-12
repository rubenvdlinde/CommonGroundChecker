import { describe, expect, it, vi } from "vitest";
import {
  analysePublicCode,
  EMPTY_PUBLICCODE_DETAILS,
  extractPublicCodeDetails,
  resolveLogoUrl,
} from "@/lib/checkers/publiccode";
import { GitHubRepositoryProvider } from "@/lib/providers/github";
import { GitLabRepositoryProvider } from "@/lib/providers/gitlab";
import type { RepoContext, RepositoryProvider } from "@/lib/providers/types";

function contextFor(provider: RepositoryProvider, projectPath: string, fileContent?: string): RepoContext {
  const parts = projectPath.split("/");
  return {
    owner: parts[0],
    repo: parts[parts.length - 1],
    projectPath,
    repoUrl: `https://${provider.hostname}/${projectPath}`,
    defaultBranch: "main",
    provider:
      fileContent === undefined
        ? provider
        : { ...provider, getFileContent: vi.fn().mockResolvedValue(fileContent) },
  };
}

const github = contextFor(GitHubRepositoryProvider, "ConductionNL/opencatalogi");
const gitlab = contextFor(GitLabRepositoryProvider, "commonground/core/dashboard");

const OPENCATALOGI = `
publiccodeYmlVersion: "0.4"
name: OpenCatalogi
url: "https://github.com/ConductionNL/opencatalogi"
developmentStatus: stable
description:
  nl:
    shortDescription: "Framework voor gefedereerde catalogi in Nextcloud"
  en:
    shortDescription: "Framework for federated catalogs in Nextcloud"
legal:
  license: EUPL-1.2
maintenance:
  type: internal
  contacts:
    - name: Conduction Development Team
      email: info@conduction.nl
`;

const OPEN_ZAAK = `
publiccodeYmlVersion: '0.2'
name: Open Zaak
url: 'https://github.com/open-zaak/open-zaak.git'
logo: 'https://raw.githubusercontent.com/open-zaak/open-zaak/main/docs/logo.svg'
developmentStatus: stable
description:
  nl:
    shortDescription: API's voor Zaakgericht werken
legal:
  license: EUPL-1.2
maintenance:
  type: contract
  contractors:
    - name: Maykin Media
      until: '2026-12-31'
`;

describe("extractPublicCodeDetails", () => {
  it("reads name, Dutch short description, status, maintenance type and contact names", async () => {
    const context = contextFor(GitHubRepositoryProvider, "ConductionNL/opencatalogi", OPENCATALOGI);
    const { result, details } = await analysePublicCode(context, ["publiccode.yml"]);

    expect(result.id).toBe("publiccode");
    expect(details).toEqual({
      displayName: "OpenCatalogi",
      shortDescription: "Framework voor gefedereerde catalogi in Nextcloud",
      logoUrl: null,
      developmentStatus: "stable",
      maintenanceType: "internal",
      maintainers: ["Conduction Development Team"],
    });
  });

  it("keeps an absolute logo URL and falls back to contractor names without contacts", async () => {
    const context = contextFor(GitHubRepositoryProvider, "open-zaak/open-zaak", OPEN_ZAAK);
    const { details } = await analysePublicCode(context, ["docs/logo.svg", "publiccode.yaml"]);

    expect(details).toMatchObject({
      displayName: "Open Zaak",
      shortDescription: "API's voor Zaakgericht werken",
      logoUrl: "https://raw.githubusercontent.com/open-zaak/open-zaak/main/docs/logo.svg",
      maintenanceType: "contract",
      maintainers: ["Maykin Media"],
    });
  });

  it("uses the English short description when there is no Dutch one", () => {
    const details = extractPublicCodeDetails(
      { name: "Signalen", description: { en: { shortDescription: "Public space reports" } } },
      github,
      "main"
    );

    expect(details.shortDescription).toBe("Public space reports");
  });

  it("uses the first language that has a short description when there is neither Dutch nor English", () => {
    const details = extractPublicCodeDetails(
      { description: { de: { longDescription: "Lang" }, it: { shortDescription: "Breve descrizione" } } },
      github,
      "main"
    );

    expect(details.shortDescription).toBe("Breve descrizione");
  });

  it("accepts regional language codes such as nl-NL", () => {
    const details = extractPublicCodeDetails(
      { description: { "en-GB": { shortDescription: "English" }, "nl-NL": { shortDescription: "Nederlands" } } },
      github,
      "main"
    );

    expect(details.shortDescription).toBe("Nederlands");
  });

  it("resolves a relative logo path to the raw URL of the scanned branch", () => {
    const details = extractPublicCodeDetails({ name: "OpenCatalogi", logo: "./docs/logo.png" }, github, "main");

    expect(details.logoUrl).toBe(
      "https://raw.githubusercontent.com/ConductionNL/opencatalogi/main/docs/logo.png"
    );
  });

  it("uses the organisation name when there is no maintenance section", () => {
    const details = extractPublicCodeDetails(
      { name: "Tool", organisation: { uri: "urn:x-onboarding:example", name: "Gemeente Voorbeeld" } },
      github,
      "main"
    );

    expect(details).toMatchObject({
      maintenanceType: null,
      maintainers: ["Gemeente Voorbeeld"],
    });
  });

  it("returns empty details for a document that is not a mapping", () => {
    expect(extractPublicCodeDetails("just text", github, "main")).toEqual(EMPTY_PUBLICCODE_DETAILS);
    expect(extractPublicCodeDetails(["a"], github, "main")).toEqual(EMPTY_PUBLICCODE_DETAILS);
  });

  it("returns empty details when there is no publiccode.yml", async () => {
    const { result, details } = await analysePublicCode(github, ["README.md"]);

    expect(result.status).toBe("fail");
    expect(details).toEqual(EMPTY_PUBLICCODE_DETAILS);
  });
});

describe("resolveLogoUrl", () => {
  it("builds a GitHub raw URL for a repository path", () => {
    expect(resolveLogoUrl("/assets/logo one.svg", github, "release/1.0")).toBe(
      "https://raw.githubusercontent.com/ConductionNL/opencatalogi/release/1.0/assets/logo%20one.svg"
    );
  });

  it("builds a GitLab raw URL for a repository path", () => {
    expect(resolveLogoUrl("docs/logo.svg", gitlab, "main")).toBe(
      "https://gitlab.com/commonground/core/dashboard/-/raw/main/docs/logo.svg"
    );
  });

  it("keeps absolute http and https URLs", () => {
    expect(resolveLogoUrl("https://example.org/logo.svg", github, "main")).toBe(
      "https://example.org/logo.svg"
    );
    expect(resolveLogoUrl("http://example.org/logo.png", gitlab, "main")).toBe(
      "http://example.org/logo.png"
    );
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "//evil.example/logo.svg",
    "../other-repo/main/logo.svg",
    "docs/../../logo.svg",
    "docs\\logo.svg",
    "",
    "   ",
  ])("rejects %j", (logo) => {
    expect(resolveLogoUrl(logo, github, "main")).toBeNull();
  });

  it("rejects a logo that is not a string", () => {
    expect(resolveLogoUrl({ url: "https://example.org/logo.svg" }, github, "main")).toBeNull();
  });
});

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

async function checkPublicCode(context: RepoContext, tree: string[]) {
  return (await analysePublicCode(context, tree)).result;
}

describe("analysePublicCode result", () => {
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
