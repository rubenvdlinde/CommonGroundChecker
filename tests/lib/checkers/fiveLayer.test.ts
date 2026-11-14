import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getFileContent: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  getFileContent: mocks.getFileContent,
}));

import { checkFiveLayer, LAYER_URI } from "@/lib/checkers/fiveLayer";

describe("checkFiveLayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when the repository clearly targets a single layer", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "This repository provides a frontend portal built with React and Next.js."
    );

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["src/frontend/app.tsx", "README.md"],
      { topics: [], description: "" }
    );

    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual([
      "Found path segment \"frontend\" in src/frontend/app.tsx",
      "Found \"frontend\" in repository metadata and docs",
    ]);
    expect(result.message).toContain("Interaction layer");
  });

  it("warns when the repository contains multiple layer signals", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "This project contains a web portal and a backend API service."
    );

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["src/ui/index.js", "services/api/index.js", "README.md"],
      { topics: [], description: "" }
    );

    expect(result.status).toBe("warn");
    expect(result.message).toContain("appears to span multiple Common Ground layers");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ui"),
        expect.stringContaining("api"),
      ])
    );
  });

  it("does not classify admin UI hints as Interaction when service/data signals are dominant", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "This register provides an admin dashboard for managing entries."
    );

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["src/admin/dashboard.tsx", "src/service/api.js", "src/db/register.js", "README.md"],
      { topics: [], description: "" }
    );

    expect(result.status).toBe("warn");
    expect(result.message).toContain("multiple Common Ground layers");
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("service"),
        expect.stringContaining("register"),
      ])
    );
    expect(result.evidence).not.toEqual(
      expect.arrayContaining([expect.stringContaining("admin")])
    );
  });

  it("warns when no layer signal is detected", async () => {
    mocks.getFileContent.mockResolvedValueOnce("A general purpose utility library.");

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["README.md", "lib/utils.ts"],
      { topics: ["library"], description: "A reusable utility package." }
    );

    expect(result.status).toBe("warn");
    expect(result.message).toContain("Could not determine the architectural layer");
    expect(result.evidence).toEqual([]);
  });

  it("uses publiccode.yml content to detect the layer", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "name: Example\ncategory: service\ndescription: Backend microservice for registration"
    );

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["publiccode.yml", "src/main.js"],
      { topics: [], description: "" }
    );

    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual([
      "Found \"service\" in repository metadata and docs",
    ]);
    expect(result.message).toContain("Service layer");
  });

  describe("declared layer (nl.vng profile)", () => {
    const tree = ["README.md", "publiccode.yml", "src/ui/index.js", "lib/Service/Api.php"];
    const readme = "A Nextcloud app with a frontend and a backend API service.";

    it("passes on a single layer declared in NL.vng.commonground, ignoring path heuristics", async () => {
      mocks.getFileContent
        .mockResolvedValueOnce(readme)
        .mockResolvedValueOnce("name: App\nNL:\n  vng:\n    commonground:\n      layer: process\n");

      const result = await checkFiveLayer("org", "repo", tree, { topics: [], description: "" });

      expect(result.status).toBe("pass");
      expect(result.confidence).toBe("high");
      expect(result.message).toBe("Declared layer: Process layer (orchestration / BFF).");
      expect(result.evidence).toEqual(['Declared "process" in publiccode.yml NL.vng.commonground']);
    });

    it("accepts the Dutch layer name and a lowercase country key", async () => {
      mocks.getFileContent
        .mockResolvedValueOnce(readme)
        .mockResolvedValueOnce("nl:\n  vng:\n    commonground:\n      layer: Integratie\n");

      const result = await checkFiveLayer("org", "repo", tree, { topics: [], description: "" });

      expect(result.status).toBe("pass");
      expect(result.message).toContain("Integration layer");
    });

    it("reads the layer from a supports entry when there is no NL section", async () => {
      mocks.getFileContent
        .mockResolvedValueOnce(readme)
        .mockResolvedValueOnce(`supports:\n  - id: ${LAYER_URI}#data\n  - id: alias:other\n`);

      const result = await checkFiveLayer("org", "repo", tree, { topics: [], description: "" });

      expect(result.status).toBe("pass");
      expect(result.evidence).toEqual(['Declared "data" in publiccode.yml supports']);
    });

    it("warns when more than one layer is declared", async () => {
      mocks.getFileContent
        .mockResolvedValueOnce(readme)
        .mockResolvedValueOnce("NL:\n  vng:\n    commonground:\n      layers: [interaction, process]\n");

      const result = await checkFiveLayer("org", "repo", tree, { topics: [], description: "" });

      expect(result.status).toBe("warn");
      expect(result.message).toContain("should belong to one Common Ground layer");
    });

    it("warns on an unknown layer value", async () => {
      mocks.getFileContent
        .mockResolvedValueOnce(readme)
        .mockResolvedValueOnce("NL:\n  vng:\n    commonground:\n      layer: frontend\n");

      const result = await checkFiveLayer("org", "repo", tree, { topics: [], description: "" });

      expect(result.status).toBe("warn");
      expect(result.message).toContain('unknown layer: frontend');
    });

    it("falls back to the heuristics when nothing is declared", async () => {
      mocks.getFileContent
        .mockResolvedValueOnce(readme)
        .mockResolvedValueOnce("name: App\n");

      const result = await checkFiveLayer("org", "repo", tree, { topics: [], description: "" });

      expect(result.status).toBe("warn");
      expect(result.message).toContain("appears to span multiple Common Ground layers");
    });
  });
});
