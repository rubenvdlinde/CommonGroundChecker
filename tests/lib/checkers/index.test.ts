import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckResult, RequirementLevel } from "@/lib/types";

const ids = [
  "sourcecode",
  "openapi",
  "license",
  "eupllicense",
  "copyrightowner",
  "publiccode",
  "docker",
  "dockerimage",
  "cicd",
  "sbom",
  "documentation",
  "changelog",
  "tests",
  "complexity",
  "codemetrics",
  "owaspsecurecoding",
  "adrvalidator",
  "contributing",
  "codeofconduct",
  "security",
  "semver",
  "fivelayer",
  "helmchart",
] as const;

const mocks = vi.hoisted(() => ({
  getRepoMeta: vi.fn(),
  getRepoTree: vi.fn(),
  getRepoVersion: vi.fn(),
  getFileContent: vi.fn(),
  getCloneUrl: vi.fn(),
  resolveRepositoryContext: vi.fn(),
  getSupportedProviders: vi.fn(),
  checkOpenApi: vi.fn(),
  checkLicense: vi.fn(),
  checkPublicCode: vi.fn(),
  checkCopyrightOwner: vi.fn(),
  checkDocker: vi.fn(),
  checkDockerImage: vi.fn(),
  checkCiConfig: vi.fn(),
  checkSbom: vi.fn(),
  checkDocumentation: vi.fn(),
  checkContributing: vi.fn(),
  checkCodeOfConduct: vi.fn(),
  checkSecurity: vi.fn(),
  checkTests: vi.fn(),
  checkComplexity: vi.fn(),
  checkSourceCode: vi.fn(),
  checkSemver: vi.fn(),
  checkFiveLayer: vi.fn(),
  checkHelmChart: vi.fn(),
  checkCodeMetrics: vi.fn(),
  checkOwaspSecureCoding: vi.fn(),
  checkEuplLicense: vi.fn(),
  checkAdrValidator: vi.fn(),
  getActiveScoringConfig: vi.fn(),
}));

const childProcessMocks = vi.hoisted(() => ({
  spawn: vi.fn<
    (...args: Parameters<typeof import("node:child_process").spawn>) => ReturnType<
      typeof import("node:child_process").spawn
    >
  >(() => {
      let stdoutCallback: (chunk: string) => void = () => {};
      let stderrCallback: (chunk: string) => void = () => {};
      let closeCallback: (code: number) => void = () => {};
      let errorCallback: (error: Error) => void = () => {};

      const child = {
        stdout: { on: (event: string, cb: (chunk: string) => void) => {
          if (event === "data") stdoutCallback = cb;
        } },
        stderr: { on: (event: string, cb: (chunk: string) => void) => {
          if (event === "data") stderrCallback = cb;
        } },
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (event === "close") closeCallback = cb as (code: number) => void;
          if (event === "error") errorCallback = cb as (error: Error) => void;
        },
      } as unknown as ReturnType<typeof import("node:child_process").spawn>;

      setImmediate(() => {
        stdoutCallback("clone output\n");
        closeCallback(0);
      });

      return child;
    }
  ),
}));

vi.mock("node:child_process", () => ({
  spawn: childProcessMocks.spawn,
}));

vi.mock("@/lib/providers", () => ({
  resolveRepositoryContext: mocks.resolveRepositoryContext,
  getSupportedProviders: mocks.getSupportedProviders,
}));

vi.mock("@/lib/checkers/openapi", () => ({ checkOpenApi: mocks.checkOpenApi }));
vi.mock("@/lib/checkers/license", () => ({ checkLicense: mocks.checkLicense }));
vi.mock("@/lib/checkers/copyrightOwner", () => ({ checkCopyrightOwner: mocks.checkCopyrightOwner }));
vi.mock("@/lib/checkers/publiccode", () => ({ checkPublicCode: mocks.checkPublicCode }));
vi.mock("@/lib/checkers/docker", () => ({ checkDocker: mocks.checkDocker }));
vi.mock("@/lib/checkers/dockerImage", () => ({ checkDockerImage: mocks.checkDockerImage }));
vi.mock("@/lib/checkers/ciConfig", () => ({ checkCiConfig: mocks.checkCiConfig }));
vi.mock("@/lib/checkers/sbom", () => ({ checkSbom: mocks.checkSbom }));
vi.mock("@/lib/checkers/documentation", () => ({ checkDocumentation: mocks.checkDocumentation }));
vi.mock("@/lib/checkers/contributing", () => ({ checkContributing: mocks.checkContributing }));
vi.mock("@/lib/checkers/codeofconduct", () => ({ checkCodeOfConduct: mocks.checkCodeOfConduct }));
vi.mock("@/lib/checkers/security", () => ({ checkSecurity: mocks.checkSecurity }));
vi.mock("@/lib/checkers/tests", () => ({ checkTests: mocks.checkTests }));
vi.mock("@/lib/checkers/complexity", () => ({ checkComplexity: mocks.checkComplexity }));
vi.mock("@/lib/checkers/codeMetrics", () => ({ checkCodeMetrics: mocks.checkCodeMetrics }));
vi.mock("@/lib/checkers/owaspSecureCoding", () => ({ checkOwaspSecureCoding: mocks.checkOwaspSecureCoding }));
vi.mock("@/lib/checkers/eupl", () => ({
  checkEuplLicense: mocks.checkEuplLicense,
}));
vi.mock("@/lib/checkers/adrValidator", () => ({ checkAdrValidator: mocks.checkAdrValidator }));
vi.mock("@/lib/checkers/sourcecode", () => ({ checkSourceCode: mocks.checkSourceCode }));
vi.mock("@/lib/checkers/semver", () => ({ checkSemver: mocks.checkSemver }));
vi.mock("@/lib/checkers/fiveLayer", () => ({ checkFiveLayer: mocks.checkFiveLayer }));
vi.mock("@/lib/checkers/helmchart", () => ({ checkHelmChart: mocks.checkHelmChart }));
vi.mock("@/lib/checkers/config", () => ({ getActiveScoringConfig: mocks.getActiveScoringConfig }));

import { runChecks } from "@/lib/checkers/index";

function resultFor(id: string, status: CheckResult["status"]): CheckResult {
  return {
    id,
    title: id,
    description: `${id} check`,
    status,
    message: `${id} ${status}`,
    evidence: [],
  };
}

function criterionConfig(
  defaultWeight: number,
  defaultRequirementLevel: RequirementLevel = "recommended"
) {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        weight: defaultWeight,
        requirementLevel: defaultRequirementLevel,
      },
    ])
  ) as Record<string, { weight: number; requirementLevel: RequirementLevel }>;
}

describe("runChecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    childProcessMocks.spawn.mockImplementation(
      (
      ) => {
        let stdoutCallback: (chunk: string) => void = () => {};
        let stderrCallback: (chunk: string) => void = () => {};
        let closeCallback: (code: number) => void = () => {};
        let errorCallback: (error: Error) => void = () => {};

        const child = {
          stdout: { on: (event: string, cb: (chunk: string) => void) => {
            if (event === "data") stdoutCallback = cb;
          } },
          stderr: { on: (event: string, cb: (chunk: string) => void) => {
            if (event === "data") stderrCallback = cb;
          } },
          on: (event: string, cb: (...args: unknown[]) => void) => {
            if (event === "close") closeCallback = cb as (code: number) => void;
            if (event === "error") errorCallback = cb as (error: Error) => void;
          },
        } as unknown as ReturnType<typeof import("node:child_process").spawn>;

      setImmediate(() => {
        stdoutCallback("clone output\n");
        closeCallback(0);
      });

      return child;
    });

    const provider = {
      getRepoMeta: mocks.getRepoMeta,
      getRepoTree: mocks.getRepoTree,
      getRepoVersion: mocks.getRepoVersion,
      getFileContent: mocks.getFileContent,
      getCloneUrl: () => "https://github.com/org/repo.git",
    };
    mocks.resolveRepositoryContext.mockReturnValue({
      owner: "org",
      repo: "repo",
      projectPath: "org/repo",
      repoUrl: "https://github.com/org/repo",
      provider,
    });
    mocks.getRepoMeta.mockResolvedValue({
      description: "Test repo",
      language: "TypeScript",
      stargazers_count: 1,
      forks_count: 2,
      default_branch: "main",
      topics: ["cg"],
      license: { spdx_id: "MIT", name: "MIT License" },
    });
    mocks.getRepoTree.mockResolvedValue(["src/main.ts", "README.md"]);
    mocks.getRepoVersion.mockResolvedValue({
      version: "v1.2.3",
      evidence: { source: "tag", detail: "tag v1.2.3" },
    });

    mocks.checkSourceCode.mockReturnValue(resultFor("sourcecode", "pass"));
    mocks.checkOpenApi.mockResolvedValue(resultFor("openapi", "pass"));
    mocks.checkLicense.mockResolvedValue(resultFor("license", "pass"));
    mocks.checkEuplLicense.mockReturnValue(resultFor("eupllicense", "warn"));
    mocks.checkCopyrightOwner.mockResolvedValue(resultFor("copyrightowner", "pass"));
    mocks.checkPublicCode.mockResolvedValue(resultFor("publiccode", "pass"));
    mocks.checkDocker.mockReturnValue(resultFor("docker", "pass"));
    mocks.checkDockerImage.mockReturnValue(resultFor("dockerimage", "pass"));
    mocks.checkCiConfig.mockReturnValue(resultFor("cicd", "pass"));
    mocks.checkSbom.mockReturnValue(resultFor("sbom", "pass"));
    mocks.checkDocumentation.mockReturnValue(resultFor("documentation", "pass"));
    mocks.checkTests.mockReturnValue(resultFor("tests", "pass"));
    mocks.checkComplexity.mockResolvedValue(resultFor("complexity", "pass"));
    mocks.checkCodeMetrics.mockResolvedValue(resultFor("codemetrics", "info"));
    mocks.checkOwaspSecureCoding.mockResolvedValue(resultFor("owaspsecurecoding", "pass"));
    mocks.checkAdrValidator.mockResolvedValue(resultFor("adrvalidator", "pass"));
    mocks.checkContributing.mockReturnValue(resultFor("contributing", "pass"));
    mocks.checkCodeOfConduct.mockReturnValue(resultFor("codeofconduct", "pass"));
    mocks.checkSecurity.mockReturnValue(resultFor("security", "pass"));
    mocks.checkSemver.mockReturnValue(resultFor("semver", "pass"));
    mocks.checkFiveLayer.mockResolvedValue(resultFor("fivelayer", "pass"));
    mocks.checkHelmChart.mockResolvedValue(resultFor("helmchart", "pass"));
  });

  it("applies weighted scoring and non-register OpenAPI bypass", async () => {
    const configById = criterionConfig(0);
    configById.tests = { weight: 1, requirementLevel: "mandatory" };
    configById.semver = { weight: 1, requirementLevel: "mandatory" };

    mocks.checkTests.mockReturnValue(resultFor("tests", "warn"));
    mocks.checkSemver.mockReturnValue(resultFor("semver", "fail"));

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-1",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", {
      isRegister: false,
    });

    expect(report.scoringConfigId).toBe("cfg-1");
    expect(report.score).toBe(25);
    expect(mocks.checkOpenApi).not.toHaveBeenCalled();
    expect(report.results).toHaveLength(23);

    const openApiResult = report.results.find((result) => result.id === "openapi");
    expect(openApiResult?.status).toBe("pass");
    expect(openApiResult?.message).toContain("not marked as a register");
  });

  it("applies fixed category weights when aggregating mandatory criteria", async () => {
    const configById = criterionConfig(0, "recommended");
    configById.sourcecode = { weight: 1, requirementLevel: "mandatory" };
    configById.openapi = { weight: 1, requirementLevel: "mandatory" };

    mocks.checkOpenApi.mockResolvedValue(resultFor("openapi", "warn"));
    mocks.checkSourceCode.mockReturnValue(resultFor("sourcecode", "pass"));

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-category-weights",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", {
      isRegister: true,
    });

    // Software Quality category score = 1.0, Architecture category score = 0.5
    // Fixed category weights are 0.15 and 0.20 respectively.
    // Total weighted category score = 1*0.15 + 0.5*0.20 = 0.25
    // Normalized by active category weights = 0.25 / 0.35 = 0.714 => 71%
    expect(report.score).toBe(71);
  });

  it("leaves criteria that could not be measured out of the category score", async () => {
    const configById = criterionConfig(0, "recommended");
    configById.tests = { weight: 1, requirementLevel: "mandatory" };
    configById.complexity = { weight: 1, requirementLevel: "mandatory" };

    mocks.checkTests.mockReturnValue(resultFor("tests", "pass"));
    mocks.checkComplexity.mockResolvedValue(resultFor("complexity", "info"));

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-unmeasured",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });

    expect(report.score).toBe(100);
    expect(report.results.find((result) => result.id === "complexity")?.status).toBe("info");
  });

  it("drops a category whose criteria could not be measured at all", async () => {
    const configById = criterionConfig(0, "recommended");
    configById.sourcecode = { weight: 1, requirementLevel: "mandatory" };
    configById.adrvalidator = { weight: 1, requirementLevel: "mandatory" };

    mocks.checkSourceCode.mockReturnValue(resultFor("sourcecode", "pass"));
    mocks.checkAdrValidator.mockResolvedValue(resultFor("adrvalidator", "info"));

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-unmeasured-category",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });

    // Only Software Quality (sourcecode pass) is scored; Architecture has nothing measured.
    expect(report.score).toBe(100);
  });

  it("uses persisted category weights from scoring config", async () => {
    const configById = criterionConfig(0, "recommended");
    configById.sourcecode = { weight: 1, requirementLevel: "mandatory" };
    configById.openapi = { weight: 1, requirementLevel: "mandatory" };

    mocks.checkOpenApi.mockResolvedValue(resultFor("openapi", "warn"));
    mocks.checkSourceCode.mockReturnValue(resultFor("sourcecode", "pass"));

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-persisted-category-weights",
      config: {
        criterionConfigByCheckId: configById,
        categoryWeights: {
          Governance: 0,
          Architecture: 1,
          Security: 0,
          "Deployment & Operations": 0,
          "Software Quality": 0,
        },
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", {
      isRegister: true,
    });

    expect(report.score).toBe(50);
  });

  it("includes coverage in final report results", async () => {
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-coverage",
      config: {
        criterionConfigByCheckId: criterionConfig(1, "recommended"),
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", {
      isRegister: false,
    });

    expect(report.results.some((result) => result.id === "coverage")).toBe(true);
  });

  it("does not apply extra EUPL bonus points", async () => {
    mocks.getRepoMeta.mockResolvedValue({
      description: "EUPL repo",
      language: "TypeScript",
      stargazers_count: 5,
      forks_count: 1,
      default_branch: "main",
      topics: [],
      license: { spdx_id: "EUPL-1.2", name: "European Union Public Licence" },
    });

    const configById = criterionConfig(1, "mandatory");
    configById.semver = { weight: 1, requirementLevel: "mandatory" };
    mocks.checkSemver.mockReturnValue(resultFor("semver", "fail"));

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-2",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", {
      isRegister: true,
    });

    expect(report.score).toBeLessThan(100);
    const licenseResult = report.results.find((result) => result.id === "license");
    expect(licenseResult?.message).not.toContain("bonus points applied");
  });

  it("uses OpenAPI validation when the repository is marked as a register", async () => {
    const configById = criterionConfig(1, "mandatory");
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-openapi",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });
    mocks.checkOpenApi.mockResolvedValue(resultFor("openapi", "pass"));

    await runChecks("https://github.com/org/repo", { isRegister: true });

    expect(mocks.checkOpenApi).toHaveBeenCalled();
  });

  it("continues analysis even when git clone fails", async () => {
    childProcessMocks.spawn.mockImplementationOnce(
      (
      ) => {
        let stdoutCallback: (chunk: string) => void = () => {};
        let stderrCallback: (chunk: string) => void = () => {};
        let closeCallback: (code: number) => void = () => {};
        let errorCallback: (error: Error) => void = () => {};

        const child = {
          stdout: { on: (event: string, cb: (chunk: string) => void) => {
            if (event === "data") stdoutCallback = cb;
          } },
          stderr: { on: (event: string, cb: (chunk: string) => void) => {
            if (event === "data") stderrCallback = cb;
          } },
          on: (event: string, cb: (...args: unknown[]) => void) => {
            if (event === "close") closeCallback = cb as (code: number) => void;
            if (event === "error") errorCallback = cb as (error: Error) => void;
          },
        } as unknown as ReturnType<typeof import("node:child_process").spawn>;

      setImmediate(() => {
        stderrCallback("git clone failed\n");
        closeCallback(1);
      });

      return child;
    });

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });

    expect(childProcessMocks.spawn).toHaveBeenCalled();
    expect(report.results.find((result) => result.id === "sourcecode")).toBeDefined();
  });

  it("returns score 0 when no mandatory criteria are configured", async () => {
    const configById = Object.fromEntries(
      ids.map((id) => [id, { weight: 1, requirementLevel: "recommended" }])
    ) as Record<string, { weight: number; requirementLevel: RequirementLevel }>;

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-zero-score",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });

    expect(report.score).toBe(0);
  });

  it("merges code metrics into Actual Source Code result", async () => {
    // Arrange: code metrics returns a metrics message
    mocks.checkSourceCode.mockReturnValue({
      id: "sourcecode",
      title: "Actual Source Code",
      description: "desc",
      status: "pass",
      message: "Found 10 source code file(s).",
      evidence: ["file1.js", "file2.py"],
    });
    mocks.checkCodeMetrics.mockResolvedValue({
      id: "codemetrics",
      title: "Code Metrics",
      description: "desc",
      status: "info",
      message: "Code metrics collected: 1,234 lines of code, 56 functions across 12 files.",
      evidence: ["Analyzer: lizard", "Total lines of code (NLOC): 1,234", "Function count: 56", "Files analyzed: 12"],
    });

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-metrics",
      config: {
        criterionConfigByCheckId: criterionConfig(1, "mandatory"),
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    // Act
    const report = await runChecks("https://github.com/org/repo");
    const sourceCodeResult = report.results.find((r) => r.id === "sourcecode");

    // Assert
    expect(sourceCodeResult).toBeDefined();
    expect(sourceCodeResult?.message).toContain("Code metrics:");
    expect(sourceCodeResult?.message).not.toContain("Found 10 source code file(s).");
    expect(sourceCodeResult?.message).toContain("1,234 lines of code");
    expect(sourceCodeResult?.message).toContain("56 functions");
    expect(sourceCodeResult?.message).toContain("12 files analyzed");
    expect(sourceCodeResult?.evidence).toContain("file1.js");
    expect(sourceCodeResult?.evidence).toContain("file2.py");
    expect(sourceCodeResult?.evidence).toContain("Analyzer: lizard");
  });

  it("throws on invalid repository URL", async () => {
    mocks.resolveRepositoryContext.mockReturnValue(null);
    await expect(runChecks("invalid-url")).rejects.toThrow("Invalid repository URL.");
  });

  it("calls progress callback at key steps", async () => {
    const progressSteps: Array<{ step: string; pct: number }> = [];
    const progressCb: (step: string, pct: number) => void = (step, pct) =>
      progressSteps.push({ step, pct });
    // Provide a full config with all required keys
    const allIds = [
      "sourcecode",
      "openapi",
      "license",
      "eupllicense",
      "copyrightowner",
      "publiccode",
      "docker",
      "dockerimage",
      "sbom",
      "documentation",
      "tests",
      "complexity",
      "owaspsecurecoding",
      "adrvalidator",
      "contributing",
      "codeofconduct",
      "security",
      "semver",
      "fivelayer",
      "helmchart",
    ];
    const configById = Object.fromEntries(allIds.map(id => [id, { weight: 1, requirementLevel: "mandatory" }]))
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-progress",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });
    await runChecks("https://github.com/org/repo", {}, progressCb);
    expect(progressSteps.length).toBeGreaterThan(0);
    expect(progressSteps[0].step).toContain("Fetching repository metadata");
  });
});