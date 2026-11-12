import { resolveRepositoryContext } from "../providers";
import type { CheckReport, CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { checkOpenApi } from "./openapi";
import { checkLicense } from "./license";
import { analysePublicCode } from "./publiccode";
import { checkDocker } from "./docker";
import { checkDockerImage, findDeclaredImages, isImageDeclarationFile } from "./dockerImage";
import { checkCiConfig } from "./ciConfig";
import { checkFiveLayer } from "./fiveLayer";
import { checkHelmChart } from "./helmchart";
import { checkSbom } from "./sbom";
import { checkDocumentation } from "./documentation";
import { checkChangelog } from "./changelog";
import { checkContributing } from "./contributing";
import { checkCodeOfConduct } from "./codeofconduct";
import { checkSecurity } from "./security";
import { checkTests } from "./tests";
import { checkComplexity } from "./complexity";
import { checkMaintainability } from "./maintainability";
import { checkOpenSourceHealth } from "./openSourceHealth";
import { checkTestCodeRatio } from "./testCodeRatio";
import { checkCodeMetrics } from "./codeMetrics";
import { checkCoverage } from "./coverage";
import { checkAdrValidator } from "./adrValidator";
import { checkSourceCode } from "./sourcecode";
import { checkSemver } from "./semver";
import { checkCopyrightOwner } from "./copyrightOwner";
import { checkOwaspSecureCoding } from "./owaspSecureCoding";
import { checkEuplLicense } from "./eupl";
import { checkLicenceConsistency } from "./licenceConsistency";
import { checkSpdxHeaders } from "./spdxHeaders";
import { checkSecretScanning } from "./secretScanning";
import { checkOpenSsfScorecard } from "./openssfScorecard";
import {
  getActiveScoringConfig,
} from "./config";
import { statusToStars } from "../stars";
import { computeEndorsement, computeRatings } from "../ratings";
import { CATEGORY_WEIGHTS, RESULT_CATEGORY_BY_ID, type CriteriaCategory } from "../criteria";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCommand(command: string, args: string[], env?: Partial<NodeJS.ProcessEnv>): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({
        code: 127,
        stdout,
        stderr: `${stderr}\n${error.message}`,
      });
    });

    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export type ProgressCallback = (step: string, pct: number) => void;

/** Evidence lines kept per result, so a report stays small enough to store. */
export const MAX_EVIDENCE_LINES = 50;

function capEvidence(evidence?: string[]): string[] | undefined {
  if (!evidence || evidence.length <= MAX_EVIDENCE_LINES) return evidence;
  return [
    ...evidence.slice(0, MAX_EVIDENCE_LINES),
    `... and ${evidence.length - MAX_EVIDENCE_LINES} more`,
  ];
}

interface RunChecksOptions {
  helmChartLocations?: string[];
  documentationLocations?: string[];
  dockerLocations?: string[];
  apiSpecificationLocations?: string[];
  isRegister?: boolean;
}

export async function runChecks(
  repoUrl: string,
  options?: RunChecksOptions,
  onProgress?: ProgressCallback,
): Promise<CheckReport> {
  const context = resolveRepositoryContext(repoUrl);
  if (!context) throw new Error("Invalid repository URL.");

  const { provider, owner, repo } = context;

  // Fetch repo metadata first (needed to know default branch)
  onProgress?.("Fetching repository metadata...", 15);
  const meta = await provider.getRepoMeta(context);
  context.defaultBranch = String(meta.default_branch ?? "main");

  // Fetch file tree and version in parallel using the real default branch
  onProgress?.("Loading repository file tree...", 30);
  const [tree, versionInfo] = await Promise.all([
    provider.getRepoTree(context, context.defaultBranch),
    provider.getRepoVersion(context),
  ]);

  const version = versionInfo.version;
  const activeScoringConfig = await getActiveScoringConfig();
  const scoringConfig = activeScoringConfig.config;
  const isRegister = options?.isRegister === true;

  let tempRoot: string | undefined;
  let localRepoPath: string | undefined;

  try {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-repo-"));
    localRepoPath = path.join(tempRoot, "repo");
    const cloneUrl = provider.getCloneUrl(context);
    const clone = await runCommand(
      "git",
      ["clone", "--depth", "1", cloneUrl, localRepoPath],
      { GIT_LFS_SKIP_SMUDGE: "1" }
    );

    if (clone.code !== 0) {
      localRepoPath = undefined;
    }

    const openApiCheckPromise: Promise<CheckResult> = isRegister
    ? checkOpenApi(context, tree, options?.apiSpecificationLocations ?? [])
    : Promise.resolve({
        id: "openapi",
        title: "API-first / OpenAPI Specification",
        description:
          "The component must expose a machine-readable OpenAPI (or Swagger) specification.",
        status: "pass",
        message:
          "Component is not marked as a register; OpenAPI specification check is not required.",
        evidence: [],
        referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
      });

  // Kick off network-dependent and slow checks immediately so they run concurrently
  const networkChecksPromise = Promise.all([
    openApiCheckPromise,
    checkLicense(context, meta, tree),
    checkCopyrightOwner(context, meta, tree),
    analysePublicCode(context, tree),
    checkFiveLayer(context, tree, meta),
    checkHelmChart(context, tree, options?.helmChartLocations ?? []),
    checkLicenceConsistency(context, tree),
    checkOpenSsfScorecard(context),
  ]);
  const complexityPromise = checkComplexity(
    owner,
    repo,
    scoringConfig.complexityThreshold,
    scoringConfig.complexityMaxCcnThreshold,
    localRepoPath,
    cloneUrl
  );
  const maintainabilityPromise = checkMaintainability(localRepoPath);
  const openSourceHealthPromise = checkOpenSourceHealth(localRepoPath);
  const testCodeRatioPromise = checkTestCodeRatio(localRepoPath);
  const codeMetricsPromise = checkCodeMetrics(owner, repo, localRepoPath, cloneUrl);
  const owaspSecureCodingPromise = checkOwaspSecureCoding(context, tree, localRepoPath);
  const spdxHeadersPromise = checkSpdxHeaders(localRepoPath);
  const secretScanningPromise = checkSecretScanning(localRepoPath);
  const adrValidatorPromise = checkAdrValidator(
    owner,
    repo,
    context.projectPath,
    context.provider.id,
    context.defaultBranch,
    tree,
    options?.apiSpecificationLocations ?? [],
    scoringConfig.spectralRulesetSource
  );

  // Instant checks — synchronous pure functions on the tree array
  onProgress?.("Running code structure checks...", 45);
  let sourcecode = checkSourceCode(tree);
  const docker = checkDocker(tree, repo);
  const declarationFiles = await Promise.all(
    tree.filter(isImageDeclarationFile).slice(0, 20).map(async (filePath) => ({
      path: filePath,
      content: (await provider.getFileContent(context, filePath)) ?? "",
    }))
  );
  const dockerimage = checkDockerImage(
    options?.dockerLocations ?? [],
    findDeclaredImages(declarationFiles, owner, repo)
  );
  const cicd = checkCiConfig(tree);
  const sbom = await checkSbom(context, tree);
  const documentation = checkDocumentation(tree, options?.documentationLocations ?? []);
  const changelog = checkChangelog(tree);
  const tests = checkTests(tree);
  const coverage = await checkCoverage(context, tree);
  const contributing = checkContributing(tree);
  const codeofconduct = checkCodeOfConduct(tree);
  const security = checkSecurity(tree);
  const semver = checkSemver(version);

  // Instant checks done; emit next step while slower checks complete in parallel
  onProgress?.("Analysing API specs, licence & deployment files...", 60);
  const [[openapi, license, copyrightowner, publiccodeAnalysis, fivelayer, helmchart, licenceconsistency, openssfscorecard], complexity, maintainability, opensourcehealth, testcoderatio, codemetrics, owaspsecurecoding, secretscanning, adrvalidator, spdxheaders] = await Promise.all([
    networkChecksPromise,
    complexityPromise,
    maintainabilityPromise,
    openSourceHealthPromise,
    testCodeRatioPromise,
    codeMetricsPromise,
    owaspSecureCodingPromise,
    secretScanningPromise,
    adrValidatorPromise,
    spdxHeadersPromise,
  ]);
  const publiccode = publiccodeAnalysis.result;

  // Always merge code metrics into Actual Source Code result if available
  if (sourcecode && codemetrics) {
    const metricsMsg = codemetrics.message || "";
    let lines = null, funcs = null, files = null;
    const match = metricsMsg.match(/([\d,]+) lines of code, ([\d,]+) functions across ([\d,]+) files/);
    if (match) {
      lines = match[1];
      funcs = match[2];
      files = match[3];
    }
    let metricsSummary = "";
    if (lines && funcs && files) {
      metricsSummary = `Code metrics: ${lines} lines of code, ${funcs} functions, ${files} files analyzed.`;
    } else if (metricsMsg) {
      metricsSummary = `Code metrics: ${metricsMsg}`;
    }
    sourcecode = {
      ...sourcecode,
      // Only show the code metrics summary, not the original file count
      message: metricsSummary ? metricsSummary : sourcecode.message,
      evidence: [
        ...(sourcecode.evidence || []),
        ...(codemetrics.evidence || []),
      ],
    };
  }
  const eupllicense = checkEuplLicense(meta, license.message);

  onProgress?.("Calculating compliance score...", 90);

  const results = [
    sourcecode,
    openapi,
    license,
    eupllicense,
    licenceconsistency,
    copyrightowner,
    spdxheaders,
    publiccode,
    docker,
    dockerimage,
    cicd,
    sbom,
    documentation,
    changelog,
    tests,
    coverage,
    complexity,
    maintainability,
    opensourcehealth,
    testcoderatio,
    // codemetrics is now merged into sourcecode, so do not include separately
    owaspsecurecoding,
    adrvalidator,
    contributing,
    codeofconduct,
    security,
    secretscanning,
    openssfscorecard,
    semver,
    fivelayer,
    helmchart,
  ];

  const categoryAggregates = results.reduce(
    (acc, result) => {
      const requirementLevel =
        scoringConfig.criterionConfigByCheckId[result.id]?.requirementLevel ??
        "recommended";
      // "info" means the criterion could not be measured, so it neither adds nor costs points.
      if (requirementLevel !== "mandatory" || result.status === "info") {
        return acc;
      }

      const criterionWeight =
        scoringConfig.criterionConfigByCheckId[result.id]?.weight ?? 1;
      const weight = Math.max(0, criterionWeight);
      if (weight === 0) {
        return acc;
      }

      const category = RESULT_CATEGORY_BY_ID[result.id] as CriteriaCategory | undefined;
      if (!category) {
        return acc;
      }

      const statusScore = scoringConfig.statusScoreByStatus[result.status] ?? 0;
      const existing = acc[category] ?? { weightedScoreSum: 0, totalWeight: 0 };
      return {
        ...acc,
        [category]: {
          weightedScoreSum: existing.weightedScoreSum + statusScore * weight,
          totalWeight: existing.totalWeight + weight,
        },
      };
    },
    {} as Record<CriteriaCategory, { weightedScoreSum: number; totalWeight: number }>
  );

  const effectiveCategoryWeights =
    scoringConfig.categoryWeights ?? CATEGORY_WEIGHTS;

  const categoryScores = Object.entries(categoryAggregates).map(
    ([category, aggregate]) => ({
      category: category as CriteriaCategory,
      score:
        aggregate.totalWeight > 0
          ? aggregate.weightedScoreSum / aggregate.totalWeight
          : 0,
      categoryWeight: effectiveCategoryWeights[category as CriteriaCategory] ?? 0,
    })
  );

  const totalCategoryWeight = categoryScores.reduce(
    (sum, category) => sum + category.categoryWeight,
    0
  );
  const weightedCategoryScore = categoryScores.reduce(
    (sum, category) => sum + category.score * category.categoryWeight,
    0
  );

  const baseScore = totalCategoryWeight > 0
    ? Math.round((weightedCategoryScore / totalCategoryWeight) * 100)
    : 0;
  const score = Math.min(100, baseScore);
  const notMeasured = results
    .filter(
      (result) =>
        result.status === "info" &&
        scoringConfig.criterionConfigByCheckId[result.id]?.requirementLevel === "mandatory"
    )
    .map((result) => result.title);

  const resultsWithRequirementLevels = [
    sourcecode,
    openapi,
    license,
    eupllicense,
    licenceconsistency,
    copyrightowner,
    spdxheaders,
    publiccode,
    docker,
    dockerimage,
    cicd,
    sbom,
    documentation,
    changelog,
    tests,
    coverage,
    complexity,
    maintainability,
    opensourcehealth,
    testcoderatio,
    // codemetrics is now merged into sourcecode, so do not include separately
    owaspsecurecoding,
    adrvalidator,
    contributing,
    codeofconduct,
    security,
    secretscanning,
    openssfscorecard,
    semver,
    fivelayer,
    helmchart,
  ].map((result) => ({
    ...result,
    requirementLevel:
      scoringConfig.criterionConfigByCheckId[result.id]?.requirementLevel ??
      "recommended",
    starRating: result.starRating ?? statusToStars(result.status),
    evidence: capEvidence(result.evidence),
  }));
  const { rating, categoryRatings, aspectRatings } = computeRatings(resultsWithRequirementLevels, scoringConfig);
  const endorsement = computeEndorsement(resultsWithRequirementLevels, rating, scoringConfig);

  return {
    repoUrl,
    owner,
    repo,
    checkedAt: new Date().toISOString(),
    scoringConfigId: activeScoringConfig.id,
    score,
    rating,
    categoryRatings,
    aspectRatings,
    endorsement,
    notMeasured,
    results: resultsWithRequirementLevels,
    repoMeta: {
      description: meta.description ?? null,
      language: meta.language ?? null,
      stars: meta.stargazers_count ?? 0,
      forks: meta.forks_count ?? 0,
      defaultBranch: meta.default_branch ?? "main",
      topics: meta.topics ?? [],
      license: meta.license?.name ?? null,
      version,
      versionEvidence: versionInfo.evidence,
      ...publiccodeAnalysis.details,
    },
  };
  } finally {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}
