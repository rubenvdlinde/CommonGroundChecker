import { describe, expect, it } from "vitest";
import {
  AI_READINESS_CHECK_IDS,
  aiReadinessFilesToRead,
  checkAgentInstructions,
  checkAgentTooling,
  checkAiReadiness,
  checkArchitectureDecisions,
  checkDevEnvironment,
  checkMachineInterfaces,
  checkSpecifications,
  findDecisionRecords,
  findInstructionFiles,
  readAiReadinessFiles,
} from "@/lib/checkers/aiReadiness";
import { RESULT_CATEGORY_BY_ID, CRITERION_VERSIONS } from "@/lib/criteria";
import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID, criterionFreshness } from "@/lib/checkers/config";
import type { RepoContext } from "@/lib/providers/types";

const COMMANDS = "## Commands\n\nRun `composer check:strict` and `npm run lint` before you push.\n";

function specs(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `openspec/specs/capability-${index}/spec.md`);
}

function adrs(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `docs/adr/${String(index + 1).padStart(4, "0")}-decision.md`);
}

describe("AI readiness criteria", () => {
  it("are informative, per-commit, in the AI readiness category and introduced in 2026.2", () => {
    for (const id of AI_READINESS_CHECK_IDS) {
      expect(RESULT_CATEGORY_BY_ID[id]).toBe("AI readiness");
      expect(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID[id].requirementLevel).toBe("informative");
      expect(criterionFreshness(id)).toBe("per-commit");
      expect(CRITERION_VERSIONS[id]).toEqual({ introducedIn: "2026.2" });
    }
  });
});

describe("checkAgentInstructions", () => {
  it("fails without an instruction file", () => {
    const result = checkAgentInstructions(["README.md", "src/index.ts"], {});
    expect(result).toMatchObject({ id: "agentinstructions", status: "fail", rating: 0.5, evidence: [] });
  });

  it("rates a short file without commands as a warning", () => {
    const result = checkAgentInstructions(["CLAUDE.md"], { "CLAUDE.md": "Be nice to the code.\n".repeat(60) });
    expect(result.rating).toBe(2.5);
    expect(result.status).toBe("warn");
  });

  it("rates a detailed file that names commands 5.5", () => {
    const content = COMMANDS + "Conventions and traps.\n".repeat(200);
    const result = checkAgentInstructions(["AGENTS.md"], { "AGENTS.md": content });
    expect(result.rating).toBe(5.5);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("names a build, test or lint command");
  });

  it("finds the known instruction files, root first, outside vendored code", () => {
    const tree = [
      "packages/api/AGENTS.md",
      ".github/copilot-instructions.md",
      ".github/instructions/php.instructions.md",
      ".cursor/rules/style.mdc",
      ".cursorrules",
      "AGENTS.md",
      "node_modules/x/AGENTS.md",
      "docs/agents-guide.md",
      "docs/features/agents.md",
    ];
    expect(findInstructionFiles(tree)).toEqual([
      ".cursorrules",
      "AGENTS.md",
      ".github/copilot-instructions.md",
      ".cursor/rules/style.mdc",
      ".github/instructions/php.instructions.md",
      "packages/api/AGENTS.md",
    ]);
  });
});

describe("checkSpecifications", () => {
  it("fails without specifications", () => {
    expect(checkSpecifications(["docs/index.md"])).toMatchObject({ status: "fail", rating: 0.5 });
  });

  it.each([
    [1, 2],
    [5, 3],
    [10, 4],
    [25, 5],
  ])("rates %i OpenSpec specs %d", (count, rating) => {
    expect(checkSpecifications(specs(count)).rating).toBe(rating);
  });

  it("adds 0.5 for changes and counts each change once, archived ones too", () => {
    const tree = [
      ...specs(25),
      "openspec/changes/add-export/proposal.md",
      "openspec/changes/add-export/tasks.md",
      "openspec/changes/archive/2026-01-01-old/proposal.md",
    ];
    const result = checkSpecifications(tree);
    expect(result.rating).toBe(5.5);
    expect(result.message).toBe("25 specifications and 2 changes found.");
  });

  it("counts Spec Kit specs and Kiro features", () => {
    const tree = [
      "specs/001-login/spec.md",
      ".kiro/specs/export/requirements.md",
      ".kiro/specs/export/design.md",
    ];
    expect(checkSpecifications(tree).message).toBe("2 specifications and 0 changes found.");
  });
});

describe("checkArchitectureDecisions", () => {
  it("fails without numbered records", () => {
    expect(checkArchitectureDecisions(["docs/adr/README.md", "docs/adr/template.md"])).toMatchObject({
      status: "fail",
      rating: 0.5,
    });
  });

  it.each([
    [1, 2],
    [3, 3],
    [5, 4],
    [10, 5.5],
  ])("rates %i records %d", (count, rating) => {
    expect(checkArchitectureDecisions(adrs(count)).rating).toBe(rating);
  });

  it("finds records in the known directories and numbering styles", () => {
    const tree = [
      "openspec/architecture/adr-001-data-layer.md",
      "doc/adr/0002-use-postgres.md",
      "decisions/3-api.md",
      "docs/architecture/decisions/0004-queue.md",
      "src/adr/0005-not-docs.ts",
      "docs/notes/0006-not-an-adr.md",
    ];
    expect(findDecisionRecords(tree)).toEqual(tree.slice(0, 4));
  });
});

describe("checkDevEnvironment", () => {
  it("rates a compose file with test, lint and build scripts 5.5", () => {
    const tree = ["docker-compose.yml", "package.json", "composer.json"];
    const files = {
      "package.json": JSON.stringify({ scripts: { build: "vite build", lint: "eslint src" } }),
      "composer.json": JSON.stringify({ scripts: { "test:unit": "phpunit" } }),
    };
    const result = checkDevEnvironment(tree, files);
    expect(result.rating).toBe(5.5);
    expect(result.evidence).toEqual([
      "docker-compose.yml",
      "package.json: build",
      "package.json: lint",
      "composer.json: test:unit",
    ]);
  });

  it("fails a bare repository", () => {
    const result = checkDevEnvironment(["src/main.c"], {});
    expect(result).toMatchObject({ status: "fail", rating: 0.5 });
    expect(result.message).toBe(
      "No dev container or Docker Compose file found; no command found to test, lint, build."
    );
  });

  it("reads Makefile targets and a dev container", () => {
    const tree = [".devcontainer/devcontainer.json", "Makefile"];
    const files = { Makefile: "VAR := 1\ntest:\n\tgo test ./...\nlint: deps\n\tgolangci-lint run\n" };
    const result = checkDevEnvironment(tree, files);
    expect(result.rating).toBe(4.5);
    expect(result.message).toContain("no command found to build");
  });

  it("gives test and build by convention for a Maven project", () => {
    expect(checkDevEnvironment(["pom.xml"], {}).rating).toBe(2.5);
  });

  it("reads tool sections of pyproject.toml", () => {
    const files = { "pyproject.toml": "[build-system]\nrequires = []\n[tool.pytest.ini_options]\n[tool.ruff]\n" };
    expect(checkDevEnvironment(["pyproject.toml"], files).rating).toBe(3.5);
  });

  it("ignores a package.json that does not parse", () => {
    expect(checkDevEnvironment(["package.json"], { "package.json": "{" }).rating).toBe(0.5);
  });
});

describe("checkMachineInterfaces", () => {
  it("weighs OpenAPI 3 points, llms.txt and MCP 1 each", () => {
    expect(checkMachineInterfaces(["openapi.json"]).rating).toBe(3.5);
    expect(checkMachineInterfaces(["openapi.json", "llms.txt", ".mcp.json"]).rating).toBe(5.5);
    expect(checkMachineInterfaces(["llms.txt"]).rating).toBe(1.5);
  });

  it("leaves out vendored code and test fixtures", () => {
    const result = checkMachineInterfaces(["vendor/x/openapi.yaml", "tests/fixtures/swagger.json"]);
    expect(result).toMatchObject({ status: "fail", rating: 0.5 });
  });
});

describe("checkAgentTooling", () => {
  it("rates many skills and a gate 5.5", () => {
    const skills = Array.from({ length: 12 }, (_, index) => `.claude/skills/skill-${index}/SKILL.md`);
    const result = checkAgentTooling([...skills, "scripts/run-hydra-gates.sh"]);
    expect(result.rating).toBe(5.5);
    expect(result.message).toBe("Skills, prompts or commands: 12; local quality gates: 1.");
  });

  it("counts prompts, commands and pre-commit", () => {
    expect(checkAgentTooling([".github/prompts/review.prompt.md"]).rating).toBe(1.5);
    expect(checkAgentTooling([".pre-commit-config.yaml"]).rating).toBe(2.5);
    expect(checkAgentTooling([".husky/_/husky.sh"]).rating).toBe(0.5);
  });
});

describe("reading the files", () => {
  it("reads root instruction and command files only", () => {
    const tree = ["AGENTS.md", "package.json", "src/package.json", "Makefile", "README.md"];
    expect(aiReadinessFilesToRead(tree)).toEqual(["AGENTS.md", "package.json", "Makefile"]);
  });

  it("skips files that cannot be read", async () => {
    const files = await readAiReadinessFiles(
      async (path) => (path === "AGENTS.md" ? "x" : path === "Makefile" ? Promise.reject(new Error("gone")) : null),
      ["AGENTS.md", "package.json", "Makefile"]
    );
    expect(files).toEqual({ "AGENTS.md": "x" });
  });

  it("returns the six criteria in order", async () => {
    const results = await checkAiReadiness({} as RepoContext, ["AGENTS.md"], async () => COMMANDS);
    expect(results.map((result) => result.id)).toEqual([...AI_READINESS_CHECK_IDS]);
    expect(results[0].rating).toBe(3.5);
  });
});
