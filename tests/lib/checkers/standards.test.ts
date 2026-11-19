import { describe, expect, it, vi } from "vitest";
import { checkStandards } from "@/lib/checkers/standards";
import { GitHubRepositoryProvider } from "@/lib/providers/github";
import type { RepoContext } from "@/lib/providers/types";

const ZAKEN_151 = "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html";
const BESLUITEN_110 = "https://vng-realisatie.github.io/gemma-zaken/standaard/besluiten/redoc-1.1.0.html";

function contextWith(files: Record<string, string>): RepoContext {
  return {
    owner: "open-zaak",
    repo: "open-zaak",
    projectPath: "open-zaak/open-zaak",
    repoUrl: "https://github.com/open-zaak/open-zaak",
    defaultBranch: "main",
    provider: {
      ...GitHubRepositoryProvider,
      getFileContent: vi.fn(async (_context: RepoContext, path: string) => files[path] ?? null),
    },
  };
}

const PUBLICCODE = `
publiccodeYmlVersion: "0.8"
supports:
  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#service"
  - id: "${ZAKEN_151}"
  - id: "${BESLUITEN_110}"
  - id: "https://example.org/my-standard/1.0"
`;

const ZAKEN_SPEC = "openapi: 3.0.3\ninfo:\n  title: Zaken API\n  version: 1.5.1\n";
const CATALOGI_SPEC = '{"openapi": "3.0.3", "info": {"title": "Catalogi API", "version": "1.3.1"}}';

describe("checkStandards", () => {
  it("lists the declared standards and cross-checks them with the OpenAPI files", async () => {
    const files = {
      "publiccode.yml": PUBLICCODE,
      "src/openzaak/components/zaken/openapi.yaml": ZAKEN_SPEC,
      "src/openzaak/components/catalogi/openapi.json": CATALOGI_SPEC,
    };
    const result = await checkStandards(contextWith(files), Object.keys(files));

    expect(result).toMatchObject({ id: "standards", status: "info", title: "Supported standards" });
    expect(result.message).toBe(
      "publiccode.yml declares 3 standards: Zaken API 1.5.1, Besluiten API 1.1.0, https://example.org/my-standard/1.0. " +
        "1 not in the registry of known standards. " +
        "OpenAPI cross-check: 1 declared and found, 1 declared but not found in the repository, 1 found in the repository but not declared."
    );
    expect(result.evidence).toEqual([
      `Declared: Zaken API 1.5.1 (${ZAKEN_151})`,
      `Declared: Besluiten API 1.1.0 (${BESLUITEN_110})`,
      "Not in the registry: https://example.org/my-standard/1.0",
      "Declared and found: Zaken API 1.5.1 in src/openzaak/components/zaken/openapi.yaml (by title)",
      "Declared, not found in the repository: Besluiten API 1.1.0",
      "Found in the repository, not declared: Catalogi API 1.3.1 in src/openzaak/components/catalogi/openapi.json (by title)",
    ]);
  });

  it("reads a publiccode.yaml deeper in the tree", async () => {
    const files = { "deploy/publiccode.yaml": PUBLICCODE };
    const result = await checkStandards(contextWith(files), Object.keys(files));
    expect(result.message).toContain("deploy/publiccode.yaml declares 3 standards");
  });

  it("reports OpenAPI files of known standards when publiccode.yml declares none", async () => {
    const files = { "publiccode.yml": "name: x\n", "api/openapi.yaml": ZAKEN_SPEC };
    const result = await checkStandards(contextWith(files), Object.keys(files));
    expect(result.message).toBe(
      "publiccode.yml declares no standards under supports. OpenAPI cross-check: 0 declared and found, 0 declared but not found in the repository, 1 found in the repository but not declared."
    );
  });

  it("says so when there is no publiccode.yml, and reads a specification at a given location", async () => {
    const files = { "spec/zrc.yaml": ZAKEN_SPEC };
    const result = await checkStandards(contextWith(files), Object.keys(files), ["/spec/zrc.yaml", "https://example.org/x.yaml"]);
    expect(result.message).toContain("No publiccode.yml found, so no standards are declared.");
    expect(result.evidence).toEqual(["Found in the repository, not declared: Zaken API 1.5.1 in spec/zrc.yaml (by title)"]);
  });

  it("lists each standard and version once, however many copies of a specification the repository has", async () => {
    const files = { "a/openapi.yaml": ZAKEN_SPEC, "b/openapi.yaml": ZAKEN_SPEC, "c/openapi.yaml": "not: [valid" };
    const result = await checkStandards(contextWith(files), Object.keys(files));
    expect(result.evidence).toEqual(["Found in the repository, not declared: Zaken API 1.5.1 in a/openapi.yaml (by title)"]);
  });

  it("finds a renamed implementation by its paths, as in Open Notificaties", async () => {
    const files = {
      "publiccode.yaml": `supports:\n  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/notificaties/redoc-1.1.0.html"\n`,
      "src/openapi.yaml":
        "openapi: 3.0.3\ninfo:\n  title: Open Notificaties API\n  version: 1.1.0\npaths:\n  /abonnement: {}\n  /kanaal: {}\n  /kanaal/{uuid}: {}\n  /notificaties: {}\n",
    };
    const result = await checkStandards(contextWith(files), Object.keys(files));
    expect(result.evidence).toContain("Declared and found: Notificaties API 1.1.0 in src/openapi.yaml (by paths)");
  });

  it("does not count the Common Ground layer as a standard", async () => {
    const files = { "publiccode.yml": 'supports:\n  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#data"\n' };
    const result = await checkStandards(contextWith(files), Object.keys(files));
    expect(result.message).toBe("publiccode.yml declares no standards under supports.");
    expect(result.evidence).toEqual([]);
  });
});

describe("findOpenApiFiles", () => {
  it("returns the OpenAPI files as spelled in the tree, known paths first", async () => {
    const { findOpenApiFiles } = await import("@/lib/checkers/openapi");
    expect(findOpenApiFiles(["src/Zaken/OpenAPI.yaml", "openapi.json", "README.md", "docs/swagger.yml"])).toEqual([
      "openapi.json",
      "src/Zaken/OpenAPI.yaml",
      "docs/swagger.yml",
    ]);
  });
});
