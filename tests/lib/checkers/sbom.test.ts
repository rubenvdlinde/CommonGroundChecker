import { describe, expect, it } from "vitest";
import { checkSbom } from "@/lib/checkers/sbom";
import type { RepoContext } from "@/lib/providers/types";

const baseContext = {
  owner: "org",
  repo: "repo",
  projectPath: "org/repo",
  repoUrl: "https://github.com/org/repo",
  provider: {
    id: "github",
    hostname: "github.com",
    parseRepoUrl: () => null,
    getRepoMeta: async () => ({}),
    getRepoTree: async () => [],
    getFileContent: async () => null,
    getRepoVersion: async () => ({
      version: null,
      evidence: { source: "none", detail: "" },
    }),
    getCloneUrl: () => "",
  },
} as unknown as RepoContext;

describe("checkSbom", () => {
  it("passes and extracts dependency count from CycloneDX JSON", async () => {
    const context = {
      ...baseContext,
      provider: {
        ...baseContext.provider,
        getFileContent: async () =>
          JSON.stringify({ bom: { components: [{}, {}, {}] } }),
      },
    } as RepoContext;

    const result = await checkSbom(context, ["sbom.cdx.json"]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("3 dependencies");
    expect(result.evidence).toContain("sbom.cdx.json");
  });

  it("passes and extracts dependency count from SPDX JSON", async () => {
    const context = {
      ...baseContext,
      provider: {
        ...baseContext.provider,
        getFileContent: async () => JSON.stringify({ packages: [{}, {}] }),
      },
    } as RepoContext;

    const result = await checkSbom(context, ["spdx.json"]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("2 dependencies");
    expect(result.evidence).toContain("spdx.json");
  });

  it("warns when no SBOM file is present", async () => {
    const result = await checkSbom(baseContext, ["README.md"]);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("No SBOM file found");
  });
  it("does not pass on source files and test fixtures under sbom/ directories (stackiq layout)", async () => {
    const files: Record<string, string> = {
      "src/components/sbom/SbomComponentsPanel.vue": "<template><div /></template>",
      "tests/fixtures/sbom/cyclonedx-1.6-valid.json": JSON.stringify({ bomFormat: "CycloneDX", components: [] }),
      "tests/fixtures/sbom/spdx-2.3-valid.json": JSON.stringify({ spdxVersion: "SPDX-2.3", packages: [] }),
    };
    const context = {
      ...baseContext,
      provider: { ...baseContext.provider, getFileContent: async (_ctx: unknown, path: string) => files[path] ?? null },
    } as RepoContext;

    const result = await checkSbom(context, [
      ...Object.keys(files),
      "lib/Service/SbomParserService.php",
      "openspec/specs/sbom-import/spec.md",
    ]);

    expect(result.status).toBe("warn");
    expect(result.evidence).toEqual([]);
  });

  it("ignores SBOM-named files in dependency and test directories", async () => {
    const result = await checkSbom(baseContext, [
      "node_modules/pkg/bom.json",
      "vendor/acme/lib/sbom.cdx.json",
      "test/data/app.spdx.json",
    ]);

    expect(result.status).toBe("warn");
  });

  it.each([
    "bom.json",
    "bom.xml",
    "sbom.cdx.json",
    "dist/app.cdx.json",
    "release/app.cdx.xml",
    "app.spdx",
    "docs/app.spdx.json",
    "app.spdx.yaml",
    "sbom/backend.cdx.json",
  ])("passes on the SBOM document %s", async (path) => {
    const result = await checkSbom(baseContext, [path]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(path);
  });

  it("passes on a CycloneDX JSON file inside sbom/ without a standard name", async () => {
    const context = {
      ...baseContext,
      provider: {
        ...baseContext.provider,
        getFileContent: async (_ctx: unknown, path: string) =>
          path === "sbom/composer.json"
            ? JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.6", components: [{}, {}] })
            : JSON.stringify({ name: "not-an-sbom" }),
      },
    } as RepoContext;

    const result = await checkSbom(context, ["sbom/package.json", "sbom/composer.json"]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual(["sbom/composer.json"]);
    expect(result.message).toContain("2 dependencies");
  });

  it("passes on a CycloneDX XML file inside a cyclonedx/ directory", async () => {
    const context = {
      ...baseContext,
      provider: {
        ...baseContext.provider,
        getFileContent: async () =>
          '<?xml version="1.0"?><bom xmlns="http://cyclonedx.org/schema/bom/1.5" version="1"><components><component type="library"/></components></bom>',
      },
    } as RepoContext;

    const result = await checkSbom(context, ["build/cyclonedx/app.xml"]);

    expect(result.status).toBe("pass");
  });
});
