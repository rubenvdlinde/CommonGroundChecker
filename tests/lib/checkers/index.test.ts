import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckResult, RequirementLevel } from "@/lib/types";

const ids = [
  "sourcecode",
  "openapi",
  "license",
  "eupllicense",
  "copyrightowner",
  "publiccode",
  "maintenance",
  "docker",
  "dockerimage",
  "cicd",
  "sbom",
  "documentation",
  "changelog",
  "tests",
  "complexity",
  "maintainability",
  "codemetrics",
  "owaspsecurecoding",
  "adrvalidator",
  "contributing",
  "codeofconduct",
  "security",
  "semver",
  "fivelayer",
  "helmchart",
  "projecthealth",
  "artifacthub",
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
  analysePublicCode: vi.fn(),
  checkMaintenance: vi.fn(),
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
  checkMaintainability: vi.fn(),
  checkSourceCode: vi.fn(),
  checkSemver: vi.fn(),
  checkFiveLayer: vi.fn(),
  checkHelmChart: vi.fn(),
  checkUsage: vi.fn(),
  checkArtifactHub: vi.fn(),
  checkCodeMetrics: vi.fn(),
  checkOwaspSecureCoding: vi.fn(),
  checkEuplLicense: vi.fn(),
  checkAdrValidator: vi.fn(),
  checkProjectHealth: vi.fn(),
  checkStandards: vi.fn(),
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
vi.mock("@/lib/checkers/publiccode", () => ({ analysePublicCode: mocks.analysePublicCode }));
vi.mock("@/lib/checkers/maintenance", () => ({ checkMaintenance: mocks.checkMaintenance }));
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
vi.mock("@/lib/checkers/maintainability", () => ({ checkMaintainability: mocks.checkMaintainability }));
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
vi.mock("@/lib/checkers/usage", () => ({ checkUsage: mocks.checkUsage }));
vi.mock("@/lib/checkers/projectHealth", () => ({ checkProjectHealth: mocks.checkProjectHealth }));
vi.mock("@/lib/checkers/artifactHub", () => ({ checkArtifactHub: mocks.checkArtifactHub }));
vi.mock("@/lib/checkers/standards", () => ({ checkStandards: mocks.checkStandards }));
vi.mock("@/lib/checkers/config", () => ({ getActiveScoringConfig: mocks.getActiveScoringConfig }));

import { runChecks } from "@/lib/checkers/index";
import { CATEGORY_ORDER, CATEGORY_WEIGHTS, CHECKLIST_VERSION, CRITERION_VERSIONS } from "@/lib/criteria";
import { resolveCategory } from "@/lib/aspects";

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
    mocks.checkStandards.mockResolvedValue(resultFor("standards", "info"));
    mocks.checkOpenApi.mockResolvedValue(resultFor("openapi", "pass"));
    mocks.checkLicense.mockResolvedValue(resultFor("license", "pass"));
    mocks.checkEuplLicense.mockReturnValue(resultFor("eupllicense", "warn"));
    mocks.checkCopyrightOwner.mockResolvedValue(resultFor("copyrightowner", "pass"));
    mocks.analysePublicCode.mockResolvedValue({
      result: resultFor("publiccode", "pass"),
      details: {
        displayName: "Test Repo",
        shortDescription: "Een testrepository",
        logoUrl: "https://raw.githubusercontent.com/org/repo/main/logo.svg",
        developmentStatus: "beta",
        maintenanceType: "community",
        maintainers: ["Test Team"],
      },
    });
    mocks.checkMaintenance.mockResolvedValue(resultFor("maintenance", "pass"));
    mocks.checkDocker.mockReturnValue(resultFor("docker", "pass"));
    mocks.checkDockerImage.mockReturnValue(resultFor("dockerimage", "pass"));
    mocks.checkCiConfig.mockReturnValue(resultFor("cicd", "pass"));
    mocks.checkSbom.mockReturnValue(resultFor("sbom", "pass"));
    mocks.checkDocumentation.mockReturnValue(resultFor("documentation", "pass"));
    mocks.checkTests.mockReturnValue(resultFor("tests", "pass"));
    mocks.checkComplexity.mockResolvedValue(resultFor("complexity", "pass"));
    mocks.checkMaintainability.mockResolvedValue({ ...resultFor("maintainability", "warn"), starRating: 3 });
    mocks.checkCodeMetrics.mockResolvedValue(resultFor("codemetrics", "info"));
    mocks.checkOwaspSecureCoding.mockResolvedValue(resultFor("owaspsecurecoding", "pass"));
    mocks.checkAdrValidator.mockResolvedValue(resultFor("adrvalidator", "pass"));
    mocks.checkContributing.mockReturnValue(resultFor("contributing", "pass"));
    mocks.checkCodeOfConduct.mockReturnValue(resultFor("codeofconduct", "pass"));
    mocks.checkSecurity.mockReturnValue(resultFor("security", "pass"));
    mocks.checkSemver.mockReturnValue(resultFor("semver", "pass"));
    mocks.checkFiveLayer.mockResolvedValue(resultFor("fivelayer", "pass"));
    mocks.checkHelmChart.mockResolvedValue(resultFor("helmchart", "pass"));
    mocks.checkUsage.mockResolvedValue({ ...resultFor("usage", "info"), usage: { sources: [] } });
    mocks.checkProjectHealth.mockResolvedValue(resultFor("projecthealth", "info"));
    mocks.checkArtifactHub.mockResolvedValue(resultFor("artifacthub", "pass"));
  });

  it("adds the informative standards result without stars and leaves it out of the verdict", async () => {
    const configById = criterionConfig(1, "mandatory");
    configById.standards = { weight: 0, requirementLevel: "informative" };
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: null,
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", { apiSpecificationLocations: ["api/openapi.yaml"] });

    const standards = report.results.find((result) => result.id === "standards");
    expect(standards).toMatchObject({ status: "info", requirementLevel: "informative" });
    expect(standards?.starRating).toBeUndefined();
    expect(mocks.checkStandards).toHaveBeenCalledWith(expect.anything(), ["src/main.ts", "README.md"], ["api/openapi.yaml"]);
    expect(report.endorsement.reasons.join(" ")).not.toContain("standards");
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
    expect(report.results).toHaveLength(29);
    expect(report.results.find((result) => result.id === "maintainability")?.starRating).toBe(3);
    expect(report.results.find((result) => result.id === "semver")?.starRating).toBe(1);
    expect(report.results.find((result) => result.id === "tests")?.starRating).toBe(3);

    const openApiResult = report.results.find((result) => result.id === "openapi");
    expect(openApiResult?.status).toBe("pass");
    expect(openApiResult?.message).toContain("not marked as a register");
  });

  it("shows an informative criterion without stars and leaves it out of the ratings", async () => {
    const configById = criterionConfig(1, "mandatory");
    configById.projecthealth = { weight: 0, requirementLevel: "informative" };
    mocks.checkProjectHealth.mockResolvedValue({
      ...resultFor("projecthealth", "info"),
      metrics: [{ id: "release-frequency", name: "Release Frequency", referenceUrl: "https://chaoss.community/", value: "3 in 12 months", explanation: "x" }],
    });
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

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });
    const health = report.results.find((result) => result.id === "projecthealth");

    expect(mocks.checkProjectHealth).toHaveBeenCalledTimes(1);
    expect(health?.requirementLevel).toBe("informative");
    expect(health?.starRating).toBeUndefined();
    expect(health?.metrics?.[0]?.value).toBe("3 in 12 months");
    expect(report.aspectRatings["project-health"]).toEqual({ rating: null });
    expect(report.results.find((result) => result.id === "license")?.starRating).toBe(5);
  });

  it("passes the KPI targets, the SLA terms and the repository's labels to project health", async () => {
    const kpiTargets = { "release-frequency": { min: 4 } };
    const slaTerms = { bug: { respondDays: 5, fixDays: "next-release" } };
    mocks.checkProjectHealth.mockResolvedValue(resultFor("projecthealth", "info"));
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-1",
      config: {
        criterionConfigByCheckId: criterionConfig(1, "mandatory"),
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
        kpiTargets,
        slaTerms,
      },
    });

    await runChecks("https://github.com/org/repo", { slaLabels: { p0: "blocking-bug" } });

    expect(mocks.checkProjectHealth).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(Date), {
      kpiTargets,
      slaTerms,
      slaLabels: { p0: "blocking-bug" },
    });
  });

  it("rates the aspects, the categories and the component, and judges the endorsement", async () => {
    const configById = criterionConfig(0);
    configById.maintainability = { weight: 1, requirementLevel: "recommended" };
    configById.license = { weight: 1, requirementLevel: "mandatory" };
    configById.coverage = { weight: 0, requirementLevel: "mandatory" };

    mocks.checkMaintainability.mockResolvedValue({
      ...resultFor("maintainability", "warn"),
      starRating: 3,
      rating: 3.4,
      aspectRatings: { analysability: 3, modifiability: 4, testability: 3, modularity: null, reusability: 4 },
    });

    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-ratings",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });

    const governance = resolveCategory("Governance")!;
    const maintainability = resolveCategory("Maintainability")!;
    expect(report.aspectRatings.licensing).toEqual({ rating: 5.5 });
    expect(report.aspectRatings.analysability).toEqual({ rating: 3 });
    expect(report.aspectRatings.modularity).toEqual({ rating: null });
    expect(report.categoryRatings[governance]).toBe(5.5);
    expect(report.categoryRatings[maintainability]).toBe(3.5);
    expect(Object.keys(report.categoryRatings)).toEqual(CATEGORY_ORDER);
    const governanceWeight = CATEGORY_WEIGHTS[governance];
    const maintainabilityWeight = CATEGORY_WEIGHTS[maintainability];
    expect(report.rating).toBe(
      Math.round(((5.5 * governanceWeight + 3.5 * maintainabilityWeight) / (governanceWeight + maintainabilityWeight)) * 10) / 10
    );
    expect(report.endorsement).toEqual({ passed: false, reasons: ["Maintainability below 4 stars (3.40)"] });
    expect(report.results.find((result) => result.id === "license")?.starRating).toBe(5);
  });

  it("does not endorse a component whose mandatory criterion fails", async () => {
    const configById = criterionConfig(1, "recommended");
    configById.license = { weight: 1, requirementLevel: "mandatory" };
    mocks.checkLicense.mockResolvedValue({ ...resultFor("license", "fail"), title: "Open source licence" });
    mocks.checkMaintainability.mockResolvedValue({ ...resultFor("maintainability", "pass"), starRating: 4, rating: 4.4 });
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-endorsement",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });

    const report = await runChecks("https://github.com/org/repo", { isRegister: false });

    expect(report.endorsement).toEqual({ passed: false, reasons: ["Mandatory criterion fails: Open source licence"] });
  });

  describe("a mandatory criterion in its transition period", () => {
    const original = CRITERION_VERSIONS.license;

    beforeEach(() => {
      CRITERION_VERSIONS.license = { introducedIn: "2026.1", mandatoryFrom: "2027-03-01" };
      const configById = criterionConfig(0, "recommended");
      configById.license = { weight: 1, requirementLevel: "mandatory" };
      configById.sourcecode = { weight: 1, requirementLevel: "mandatory" };
      mocks.checkLicense.mockResolvedValue({ ...resultFor("license", "fail"), title: "Open source licence" });
      mocks.checkMaintainability.mockResolvedValue({ ...resultFor("maintainability", "pass"), starRating: 4, rating: 4.4 });
      mocks.getActiveScoringConfig.mockResolvedValue({
        id: "cfg-transition",
        config: {
          criterionConfigByCheckId: configById,
          statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
          complexityThreshold: 12,
          complexityMaxCcnThreshold: 20,
          spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
        },
      });
    });

    afterEach(() => {
      CRITERION_VERSIONS.license = original;
    });

    it("records the checklist version the report was measured against", async () => {
      const report = await runChecks("https://github.com/org/repo", { now: new Date("2027-02-01T00:00:00Z") });

      expect(report.checklistVersion).toBe(CHECKLIST_VERSION);
      expect(report.checkedAt).toBe("2027-02-01T00:00:00.000Z");
    });

    it("before the date, marks the fail as a transition and leaves it out of the mandatory set and the verdict", async () => {
      const report = await runChecks("https://github.com/org/repo", { now: new Date("2027-02-28T23:59:59Z") });

      const license = report.results.find((result) => result.id === "license");
      expect(license?.status).toBe("fail");
      expect(license?.mandatoryFrom).toBe("2027-03-01");
      // Only sourcecode (Software Quality, pass) is left in the mandatory set.
      expect(report.score).toBe(100);
      expect(report.endorsement.reasons).not.toContain("Mandatory criterion fails: Open source licence");
    });

    it("from the date on, counts the fail normally", async () => {
      const report = await runChecks("https://github.com/org/repo", { now: new Date("2027-03-01T00:00:00Z") });

      const license = report.results.find((result) => result.id === "license");
      expect(license).not.toHaveProperty("mandatoryFrom");
      // Governance 0 (weight 0.2) and Software Quality 1 (weight 0.15): 0.15 / 0.35 = 43%.
      expect(report.score).toBe(43);
      expect(report.endorsement.reasons).toContain("Mandatory criterion fails: Open source licence");
    });
  });

  it("passes the tree, the locations and the clock to the Artifact Hub check, which warns until 19 May 2027", async () => {
    const configById = criterionConfig(1, "recommended");
    configById.artifacthub = { weight: 1, requirementLevel: "mandatory" };
    mocks.checkArtifactHub.mockResolvedValue({ ...resultFor("artifacthub", "fail"), title: "Helm chart on Artifact Hub, images scanned" });
    mocks.checkMaintainability.mockResolvedValue({ ...resultFor("maintainability", "pass"), starRating: 4, rating: 4.4 });
    mocks.getActiveScoringConfig.mockResolvedValue({
      id: "cfg-artifacthub",
      config: {
        criterionConfigByCheckId: configById,
        statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
        complexityThreshold: 12,
        complexityMaxCcnThreshold: 20,
        spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      },
    });
    const options = { dockerLocations: ["ghcr.io/org/repo"], helmChartLocations: ["charts/repo"] };

    const before = await runChecks("https://github.com/org/repo", { ...options, now: new Date("2027-05-18T23:59:59Z") });
    const after = await runChecks("https://github.com/org/repo", { ...options, now: new Date("2027-05-19T00:00:00Z") });

    expect(mocks.checkArtifactHub).toHaveBeenCalledWith(expect.objectContaining({ repo: "repo" }), ["src/main.ts", "README.md"], {
      dockerImage: resultFor("dockerimage", "pass"),
      helmChart: resultFor("helmchart", "pass"),
      helmChartLocations: ["charts/repo"],
      now: new Date("2027-05-18T23:59:59Z"),
    });
    expect(before.results.find((result) => result.id === "artifacthub")?.mandatoryFrom).toBe("2027-05-19");
    expect(before.endorsement.reasons).not.toContain("Mandatory criterion fails: Helm chart on Artifact Hub, images scanned");
    expect(after.results.find((result) => result.id === "artifacthub")).not.toHaveProperty("mandatoryFrom");
    expect(after.endorsement.reasons).toContain("Mandatory criterion fails: Helm chart on Artifact Hub, images scanned");
  });

  it.each(["2027-05-18T00:00:00Z", "2027-05-19T00:00:00Z"])(
    "leaves a criterion that does not apply out of the score and the ratings, on %s",
    async (now) => {
      const configById = criterionConfig(0, "recommended");
      configById.sourcecode = { weight: 1, requirementLevel: "mandatory" };
      configById.artifacthub = { weight: 1, requirementLevel: "mandatory" };
      mocks.checkArtifactHub.mockResolvedValue({ ...resultFor("artifacthub", "info"), notApplicable: true });
      mocks.getActiveScoringConfig.mockResolvedValue({
        id: "cfg-not-applicable",
        config: {
          criterionConfigByCheckId: configById,
          statusScoreByStatus: { pass: 1, warn: 0.5, info: 0.5, fail: 0 },
          complexityThreshold: 12,
          complexityMaxCcnThreshold: 20,
          spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
        },
      });

      const report = await runChecks("https://github.com/org/repo", { now: new Date(now) });

      // Only sourcecode counts. Counted as an info result, it would make the score 69 from 19 May 2027.
      expect(report.score).toBe(100);
      expect(report.aspectRatings["container-images"]).toEqual({ rating: null });
      expect(report.categoryRatings[resolveCategory("Security")!]).toBeNull();
      expect(report.results.find((result) => result.id === "artifacthub")?.notApplicable).toBe(true);
    }
  );

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

  it("passes the publiccode.yml data to the usage check and gives its result no stars", async () => {
    const publiccode = { usedBy: ["Gemeente Utrecht"] };
    mocks.analysePublicCode.mockResolvedValue({
      result: { ...resultFor("publiccode", "pass"), publiccode },
      details: {},
    });

    const report = await runChecks("https://github.com/org/repo", { dockerLocations: ["org/image"] });

    expect(mocks.checkUsage).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "org", repo: "repo" }),
      expect.anything(),
      expect.any(Array),
      publiccode,
      { dockerLocations: ["org/image"] }
    );
    const usage = report.results.find((result) => result.id === "usage");
    expect(usage?.status).toBe("info");
    expect(usage?.starRating).toBeUndefined();
    expect(report.aspectRatings["usage-and-ecosystem"]).toEqual({ rating: null });
  });

  it("adds the publiccode.yml details to the report's repoMeta", async () => {
    const report = await runChecks("https://github.com/org/repo");

    expect(report.results.find((result) => result.id === "publiccode")?.status).toBe("pass");
    expect(report.repoMeta).toMatchObject({
      description: "Test repo",
      displayName: "Test Repo",
      shortDescription: "Een testrepository",
      logoUrl: "https://raw.githubusercontent.com/org/repo/main/logo.svg",
      developmentStatus: "beta",
      maintenanceType: "community",
      maintainers: ["Test Team"],
    });
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