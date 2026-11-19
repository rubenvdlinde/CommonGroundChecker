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

  it.each([
    ["A register for objects."],
    ["Build a register for objects."],
    ["A register with an interest in objects."],
    ["A register; see the user guide for the next steps."],
  ])("matches whole words only, so %s is a data layer component", async (readme) => {
    mocks.getFileContent.mockResolvedValueOnce(readme);

    const result = await checkFiveLayer("org", "repo", ["README.md", "lib/Db/ObjectMapper.php"], { topics: [], description: "" });

    expect(result.status).toBe("pass");
    expect(result.message).toContain("Data layer");
  });

  it("matches whole directory names, not parts of file or directory names", async () => {
    mocks.getFileContent.mockResolvedValueOnce("A register for objects.");

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["README.md", "lib/BackgroundJob/StateHistoryRebuildJob.php", "lib/Db/CountLinksByObjectUuidTrait.php", "src/guides/index.ts"],
      { topics: [], description: "" }
    );

    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual([
      "Found path segment \"db\" in lib/Db/CountLinksByObjectUuidTrait.php",
      "Found \"register\" in repository metadata and docs",
    ]);
  });

  it("ignores documentation, test, example and vendored directories", async () => {
    mocks.getFileContent.mockResolvedValueOnce("A register for objects.");

    const result = await checkFiveLayer(
      "org",
      "repo",
      ["README.md", "docs/ui/screens.md", "tests/api/ObjectTest.php", "examples/portal/index.html", "vendor/acme/service/Client.php", ".github/workflows/ui.yml"],
      { topics: [], description: "" }
    );

    expect(result.status).toBe("pass");
    expect(result.message).toContain("Data layer");
  });

  it("still reads a layer directory in the component's own code", async () => {
    mocks.getFileContent.mockResolvedValueOnce("A register for objects.");

    const result = await checkFiveLayer("org", "repo", ["README.md", "src/ui/index.ts"], { topics: [], description: "" });

    expect(result.status).toBe("warn");
    expect(result.evidence).toContain("Found path segment \"ui\" in src/ui/index.ts");
  });

  it("reads Next.js as a framework name, not the word next", async () => {
    mocks.getFileContent.mockResolvedValueOnce("A portal built with Next.js.");

    const result = await checkFiveLayer("org", "repo", ["README.md"], { topics: [], description: "" });

    expect(result.evidence).toEqual(expect.arrayContaining([expect.stringContaining("portal")]));
    expect(result.message).toContain("Interaction layer");
  });

  describe("declared layer", () => {
    const tree = ["README.md", "publiccode.yml", "src/ui/index.js", "lib/Service/Api.php"];
    const readme = "A Nextcloud app with a frontend and a backend API service.";

    async function check(publiccode: string) {
      mocks.getFileContent.mockResolvedValueOnce(readme).mockResolvedValueOnce(publiccode);
      return checkFiveLayer("org", "repo", tree, { topics: [], description: "" });
    }

    it("passes on a single layer declared in supports, ignoring the heuristics", async () => {
      const result = await check(`supports:\n  - id: ${LAYER_URI}#process\n  - id: alias:gdpr\n`);

      expect(result.status).toBe("pass");
      expect(result.confidence).toBe("high");
      expect(result.message).toBe("Declared layer: Process layer (orchestration / BFF).");
      expect(result.evidence).toEqual(['Declared "process" in publiccode.yml supports']);
    });

    it("accepts the Dutch layer name", async () => {
      const result = await check(`supports:\n  - id: ${LAYER_URI}#Integratie\n`);

      expect(result.status).toBe("pass");
      expect(result.message).toContain("Integration layer");
    });

    it("warns when more than one layer is declared", async () => {
      const result = await check(`supports:\n  - id: ${LAYER_URI}#interaction\n  - id: ${LAYER_URI}#process\n`);

      expect(result.status).toBe("warn");
      expect(result.message).toContain("should belong to one Common Ground layer");
    });

    it("warns on an unknown layer value", async () => {
      const result = await check(`supports:\n  - id: ${LAYER_URI}#frontend\n`);

      expect(result.status).toBe("warn");
      expect(result.message).toContain("unknown layer: frontend");
    });

    it("falls back to the heuristics when nothing is declared", async () => {
      const result = await check("name: App\n");

      expect(result.status).toBe("warn");
      expect(result.message).toContain("appears to span multiple Common Ground layers");
    });

    it("does not read a country section, which publiccode.yml does not define for NL", async () => {
      const result = await check("NL:\n  vng:\n    commonground:\n      layer: process\n");

      expect(result.status).toBe("warn");
      expect(result.message).toContain("appears to span multiple Common Ground layers");
    });
  });
});
