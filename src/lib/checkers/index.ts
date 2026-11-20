import { resolveRepositoryContext } from "../providers";
import type { CheckReport, CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { checkOpenApi } from "./openapi";
import { checkLicense } from "./license";
import { analysePublicCode } from "./publiccode";
import { checkDocker } from "./docker";
import { checkDockerImage } from "./dockerImage";
import { checkCiConfig } from "./ciConfig";
import { checkFiveLayer } from "./fiveLayer";
import { checkHelmChart } from "./helmchart";
import { checkSbom } from "./sbom";
import { checkArtifactHub } from "./artifactHub";
import { checkDocumentation } from "./documentation";
import { checkChangelog } from "./changelog";
import { checkMaintenance } from "./maintenance";
import { checkContributing } from "./contributing";
import { checkCodeOfConduct } from "./codeofconduct";
import { checkSecurity } from "./security";
import { checkTests } from "./tests";
import { checkComplexity } from "./complexity";
import { checkMaintainability } from "./maintainability";
import { checkCodeMetrics } from "./codeMetrics";
import { checkCoverage } from "./coverage";
import { checkAdrValidator } from "./adrValidator";
import { checkSourceCode } from "./sourcecode";
import { checkSemver } from "./semver";
import { checkCopyrightOwner } from "./copyrightOwner";
import { checkOwaspSecureCoding } from "./owaspSecureCoding";
import { checkEuplLicense } from "./eupl";
import { checkUsage } from "./usage";
import { USAGE_CHECK_ID } from "../usage";
import { checkProjectHealth } from "./projectHealth";
import { checkStandards } from "./standards";
import {
  getActiveScoringConfig,
  type ActiveScoringConfig,
} from "./config";
import { statusToStars } from "../stars";
import { computeEndorsement, computeRatings } from "../ratings";
import { resolveScanRef } from "../scanRef";
import { checkerFingerprint } from "../checkerFingerprint";
import {
  decideScanMode,
  inputsFingerprint,
  readFullScanIntervalDays,
  type PreviousAnalysis,
} from "../incremental";
import {
  CATEGORY_WEIGHTS,
  CHECKLIST_VERSION,
  RESULT_CATEGORY_BY_ID,
  upcomingMandatoryFrom,
  withTransition,
  type CriteriaCategory,
} from "../criteria";
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

export interface RunChecksOptions {
  helmChartLocations?: string[];
  documentationLocations?: string[];
  dockerLocations?: string[];
  apiSpecificationLocations?: string[];
  isRegister?: boolean;
  /** Scan this checkout in place instead of cloning the repository */
  localRepoPath?: string;
  /** Use this scoring configuration instead of the one served by the API */
  scoringConfig?: ActiveScoringConfig;
  /** The repository's own labels for the SLA times, on top of GitHub's default labels */
  slaLabels?: Record<string, string> | null;
  /** Branch or tag to scan, or `latest-release`; the default branch when unset. */
  ref?: string | null;
  /** The time the check runs at; decides which criteria are still in their transition period */
  now?: Date;
  /** The previous completed analysis of this repository; its code checks are reused when the commit did not change */
  previousAnalysis?: PreviousAnalysis | null;
  /** Run every check, also when the commit did not change */
  full?: boolean;
  /** A full scan at least this often; FULL_SCAN_INTERVAL_DAYS or 7 when unset */
  fullScanIntervalDays?: number;
}

export async function runChecks(
  repoUrl: string,
  options?: RunChecksOptions,
  onProgress?: ProgressCallback,
): Promise<CheckReport> {
  const context = resolveRepositoryContext(repoUrl);
  if (!context) throw new Error("Invalid repository URL.");
  return runChecksOnContext(context, options, onProgress);
}

export async function runChecksOnContext(
  context: RepoContext,
  options?: RunChecksOptions,
  onProgress?: ProgressCallback,
): Promise<CheckReport> {
  const { provider, owner, repo } = context;
  const startedAt = Date.now();

  // Fetch repo metadata first (needed to know default branch)
  onProgress?.("Fetching repository metadata...", 15);
  const meta = await provider.getRepoMeta(context);
  context.defaultBranch = String(meta.default_branch ?? "main");

  const scanned = await resolveScanRef(context, context.defaultBranch, options?.ref ?? null);
  // The commit pins the tree and every file read to one snapshot of the ref.
  context.ref = scanned.commit ?? scanned.ref;

  onProgress?.("Loading repository file tree...", 30);
  const [tree, versionInfo] = await Promise.all([
    provider.getRepoTree(context, context.ref),
    provider.getRepoVersion(context),
  ]);

  const version = versionInfo.version;
  const activeScoringConfig = options?.scoringConfig ?? await getActiveScoringConfig();
  const scoringConfig = activeScoringConfig.config;
  const isRegister = options?.isRegister === true;
  const checkedAt = options?.now ?? new Date();

  const toolFingerprint = checkerFingerprint().fingerprint;
  const scanInputs = inputsFingerprint({
    helmChartLocations: options?.helmChartLocations,
    dockerLocations: options?.dockerLocations,
    documentationLocations: options?.documentationLocations,
    apiSpecificationLocations: options?.apiSpecificationLocations,
    isRegister,
    complexityThreshold: scoringConfig.complexityThreshold,
    complexityMaxCcnThreshold: scoringConfig.complexityMaxCcnThreshold,
  });
  const decision = decideScanMode({
    previous: options?.previousAnalysis ?? null,
    commit: scanned.commit,
    checklistVersion: CHECKLIST_VERSION,
    toolFingerprint,
    inputsFingerprint: scanInputs,
    now: checkedAt,
    fullScanIntervalDays: options?.fullScanIntervalDays ?? readFullScanIntervalDays(),
    full: options?.full,
  });
  const { reused } = decision;
  /** The reused result of a per-commit criterion, else the result of running its check. */
  const measure = (id: string, run: () => CheckResult | Promise<CheckResult>): Promise<CheckResult> => {
    const copy = reused.get(id);
    return copy ? Promise.resolve(copy) : Promise.resolve().then(run);
  };

  let tempRoot: string | undefined;
  let clonePromise: Promise<string | undefined> | null = null;

  try {
    const cloneUrl = provider.getCloneUrl(context);
    /** The checkout the code tools read, cloned on first use; a scan that reuses every code check never clones. */
    const checkout = (): Promise<string | undefined> => {
      clonePromise ??= (async () => {
        if (options?.localRepoPath) return options.localRepoPath;
        tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-repo-"));
        const target = path.join(tempRoot, "repo");
        const clone = await runCommand(
          "git",
          ["clone", "--depth", "1", "--branch", scanned.ref, cloneUrl, target],
          { GIT_LFS_SKIP_SMUDGE: "1" }
        );
        return clone.code === 0 ? target : undefined;
      })();
      return clonePromise;
    };

    if (decision.mode === "partial") {
      onProgress?.("Code unchanged: reusing the code checks, running the outside-world checks...", 35);
    }

    const openApiCheckPromise = measure("openapi", () =>
      isRegister
        ? checkOpenApi(context, tree, options?.apiSpecificationLocations ?? [])
        : {
            id: "openapi",
            title: "API-first / OpenAPI Specification",
            description:
              "The component must expose a machine-readable OpenAPI (or Swagger) specification.",
            status: "pass",
            message:
              "Component is not marked as a register; OpenAPI specification check is not required.",
            evidence: [],
            referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
          }
    );

  const dockerimagePromise = measure("dockerimage", () => checkDockerImage(options?.dockerLocations ?? []));
  const helmChartPromise = measure("helmchart", () => checkHelmChart(context, tree, options?.helmChartLocations ?? []));

  // Kick off network-dependent and slow checks immediately so they run concurrently.
  // publiccode.yml is always read: the repository details and the usage check need it.
  const networkChecksPromise = Promise.all([
    openApiCheckPromise,
    measure("license", () => checkLicense(context, meta, tree)),
    measure("copyrightowner", () => checkCopyrightOwner(context, meta, tree)),
    analysePublicCode(context, tree),
    measure("maintenance", () => checkMaintenance(context, tree)),
    measure("fivelayer", () => checkFiveLayer(context, tree, meta)),
    helmChartPromise,
    measure("projecthealth", () =>
      checkProjectHealth(context, meta, new Date(), {
        kpiTargets: scoringConfig.kpiTargets,
        slaTerms: scoringConfig.slaTerms,
        slaLabels: options?.slaLabels,
      })
    ),
    measure("standards", () => checkStandards(context, tree, options?.apiSpecificationLocations ?? [])),
  ]);
  const usagePromise = networkChecksPromise.then(([, , , publiccodeAnalysis]) =>
    measure(USAGE_CHECK_ID, () =>
      checkUsage(context, meta, tree, publiccodeAnalysis.result.publiccode, {
        dockerLocations: options?.dockerLocations,
      })
    )
  );
  const complexityPromise = measure("complexity", async () =>
    checkComplexity(
      owner,
      repo,
      scoringConfig.complexityThreshold,
      scoringConfig.complexityMaxCcnThreshold,
      await checkout(),
      cloneUrl,
      scanned.ref
    )
  );
  const maintainabilityPromise = measure("maintainability", async () => checkMaintainability(await checkout()));
  // Code metrics are merged into the source code result, so a reused source code result needs none.
  const codeMetricsPromise: Promise<CheckResult | null> = reused.has("sourcecode")
    ? Promise.resolve(null)
    : checkout().then((localRepoPath) => checkCodeMetrics(owner, repo, localRepoPath, cloneUrl, scanned.ref));
  const artifactHubPromise = Promise.all([dockerimagePromise, helmChartPromise]).then(([dockerImage, helmChart]) =>
    measure("artifacthub", () =>
      checkArtifactHub(context, tree, {
        dockerImage,
        helmChart,
        helmChartLocations: options?.helmChartLocations ?? [],
        now: checkedAt,
      })
    )
  );
  const owaspSecureCodingPromise = measure("owaspsecurecoding", async () =>
    checkOwaspSecureCoding(context, tree, await checkout())
  );
  const adrValidatorPromise = measure("adrvalidator", () =>
    checkAdrValidator(
      owner,
      repo,
      context.projectPath,
      context.provider.id,
      scanned.commit ?? scanned.ref,
      tree,
      options?.apiSpecificationLocations ?? [],
      scoringConfig.spectralRulesetSource
    )
  );

  // Instant checks — synchronous pure functions on the tree array
  onProgress?.("Running code structure checks...", 45);
  const freshSourcecode = !reused.has("sourcecode");
  let sourcecode = await measure("sourcecode", () => checkSourceCode(tree));
  const docker = await measure("docker", () => checkDocker(tree, repo));
  const dockerimage = await dockerimagePromise;
  const cicd = await measure("cicd", () => checkCiConfig(tree));
  const sbom = await measure("sbom", () => checkSbom(context, tree));
  const documentation = await measure("documentation", () =>
    checkDocumentation(tree, options?.documentationLocations ?? [])
  );
  const changelog = await measure("changelog", () => checkChangelog(tree));
  const tests = await measure("tests", () => checkTests(tree));
  const coverage = await measure("coverage", () => checkCoverage(context, tree));
  const contributing = await measure("contributing", () => checkContributing(tree));
  const codeofconduct = await measure("codeofconduct", () => checkCodeOfConduct(tree));
  const security = await measure("security", () => checkSecurity(tree));
  const semver = await measure("semver", () => checkSemver(version));

  // Instant checks done; emit next step while slower checks complete in parallel
  onProgress?.("Analysing API specs, licence & deployment files...", 60);
  const [[openapi, license, copyrightowner, publiccodeAnalysis, maintenance, fivelayer, helmchart, projecthealth, standards], complexity, maintainability, codemetrics, owaspsecurecoding, adrvalidator, usage, artifacthub] = await Promise.all([
    networkChecksPromise,
    complexityPromise,
    maintainabilityPromise,
    codeMetricsPromise,
    owaspSecureCodingPromise,
    adrValidatorPromise,
    usagePromise,
    artifactHubPromise,
  ]);
  const publiccode = reused.get("publiccode") ?? publiccodeAnalysis.result;

  // Always merge code metrics into Actual Source Code result if available
  if (freshSourcecode && sourcecode && codemetrics) {
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
  const eupllicense = await measure("eupllicense", () => checkEuplLicense(meta, license.message));

  onProgress?.("Calculating compliance score...", 90);

  const results = [
    sourcecode,
    openapi,
    license,
    eupllicense,
    copyrightowner,
    publiccode,
    maintenance,
    docker,
    dockerimage,
    cicd,
    sbom,
    artifacthub,
    documentation,
    changelog,
    tests,
    coverage,
    complexity,
    maintainability,
    // codemetrics is now merged into sourcecode, so do not include separately
    owaspsecurecoding,
    adrvalidator,
    contributing,
    codeofconduct,
    security,
    semver,
    fivelayer,
    helmchart,
    projecthealth,
    standards,
  ];

  const categoryAggregates = results.reduce(
    (acc, result) => {
      const requirementLevel =
        scoringConfig.criterionConfigByCheckId[result.id]?.requirementLevel ??
        "recommended";
      if (
        requirementLevel !== "mandatory" ||
        result.status === "info" ||
        result.notApplicable ||
        upcomingMandatoryFrom({ id: result.id, requirementLevel }, checkedAt) !== null
      ) {
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
    copyrightowner,
    publiccode,
    maintenance,
    docker,
    dockerimage,
    cicd,
    sbom,
    artifacthub,
    documentation,
    changelog,
    tests,
    coverage,
    complexity,
    maintainability,
    // codemetrics is now merged into sourcecode, so do not include separately
    owaspsecurecoding,
    adrvalidator,
    contributing,
    codeofconduct,
    security,
    semver,
    fivelayer,
    helmchart,
    usage,
    projecthealth,
    standards,
  ].map((result) =>
    withTransition(
      {
        ...result,
        requirementLevel:
          scoringConfig.criterionConfigByCheckId[result.id]?.requirementLevel ??
          "recommended",
        evidence: capEvidence(result.evidence),
      },
      checkedAt
    )
  );
  // Rated before the status stars are filled in, so a criterion without a scale is rated from its status.
  const { rating, categoryRatings, aspectRatings } = computeRatings(resultsWithRequirementLevels, scoringConfig);
  const endorsement = computeEndorsement(resultsWithRequirementLevels, rating, scoringConfig);
  // An informative criterion is shown without stars.
  const resultsWithStars = resultsWithRequirementLevels.map((result) =>
    result.requirementLevel === "informative" || result.id === USAGE_CHECK_ID
      ? result
      : { ...result, starRating: result.starRating ?? statusToStars(result.status) }
  );

  return {
    repoUrl: context.repoUrl,
    owner,
    repo,
    checkedAt: checkedAt.toISOString(),
    scoringConfigId: activeScoringConfig.id,
    checklistVersion: CHECKLIST_VERSION,
    score,
    rating,
    categoryRatings,
    aspectRatings,
    endorsement,
    notMeasured,
    results: resultsWithStars,
    scannedRef: scanned.ref,
    scannedRefKind: scanned.kind,
    scannedCommit: scanned.commit,
    ...(scanned.warning ? { scanRefWarning: scanned.warning } : {}),
    scanMode: decision.mode,
    scanModeReason: decision.reason,
    scanDurationSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
    toolFingerprint,
    inputsFingerprint: scanInputs,
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
