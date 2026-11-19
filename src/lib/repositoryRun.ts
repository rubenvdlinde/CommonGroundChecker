import { dataSource, type RepositoryExtras, type StaticAnalysisExtras } from "@/lib/dataSource";
import { readReusedFrom } from "@/lib/scanModeText";
import { parseMeasurements, parseMetrics } from "@/lib/measurements";
import { countIssues } from "@/lib/issues";
import { isRating, type Ratings } from "@/lib/ratings";
import { loadStoredRatings } from "@/lib/storedRatings";
import { parseSla } from "@/lib/sla";
import { USAGE_CHECK_ID, readUsageData } from "@/lib/usage";
import { readPublicCodeData } from "@/lib/checkers/publiccode";
import { isMandatoryFromDate } from "@/lib/criteria";
import { componentHref } from "@/lib/routes";
import { developmentStatusOf, type MaintainedSla } from "@/lib/maintained";
import { computeLifecycleStatus, openDropsOf, type LifecycleResult } from "@/lib/lifecycle";
import type { CheckReport, CheckResult, Endorsement, StarRating } from "@/lib/types";
import type { MaintenanceDrop, RepoMeta } from "@/generated/openapi-client";

/** How many stored runs a repository page loads. */
export const RUN_HISTORY_LIMIT = 50;

/** One stored run as the run list and the rating graph show it. */
export interface RunSummary {
  id: string;
  checkedAt: string;
  version: string | null;
  score: number;
  /** Overall rating, stored or computed from the stored results */
  rating: number | null;
  passed: boolean;
  /** Number of entries in the run's errors block; null when no results are stored */
  errors: number | null;
  /** Number of entries in the run's warnings block; null when no results are stored */
  warnings: number | null;
  /** Organisations under usedBy at this run; null when the run did not record them */
  declaredUserCount?: number | null;
  /** False for an older run of the static site, which keeps its summary and not its results */
  detailAvailable?: boolean;
}

/** The run a repository page shows in full. */
export interface SelectedRun extends RunSummary {
  results: CheckResult[];
  categoryRatings: Ratings["categoryRatings"];
  aspectRatings: Ratings["aspectRatings"];
  endorsement: Endorsement;
  /** The checklist version the run was measured against; null for runs from before the checklist had versions */
  checklistVersion: string | null;
  /** The branch or tag that was scanned, its kind and commit; null for runs from before refs were stored */
  scannedRef: string | null;
  scannedRefKind: string | null;
  scannedCommit: string | null;
  /** `full` or `partial`; null for runs from before scan modes were stored */
  scanMode: string | null;
  scanDurationSeconds: number | null;
}

export interface RepositoryRun {
  repository: {
    id: string;
    owner: string;
    name: string;
    repoUrl: string;
    followed: boolean;
    checkIntervalHours: number | null;
    nextCheckAt: string | null;
    /** The branch or tag followed scans use; null for the default branch */
    scanRef: string | null;
    /** When an admin retired the repository, or null */
    retiredAt: string | null;
    retiredReason: string | null;
  };
  repoMeta: CheckReport["repoMeta"];
  /** Every loaded run, newest first */
  runs: RunSummary[];
  /** The requested run, or the latest one; null when no run is stored */
  selected: SelectedRun | null;
  latestId: string | null;
  /** The latest run's verdict and publiccode.yml development status, for the Common Ground status */
  latest: { endorsement: Endorsement | null; developmentStatus: string | null };
  /** Drops the backend recorded, newest first; empty on a backend without drops */
  drops: MaintenanceDrop[];
  /** What the static site adds: the providers, the basisset flag and the retirement; null on the server */
  extras: RepositoryExtras | null;
}

export type RepositoryRunResult =
  | { kind: "found"; run: RepositoryRun }
  | { kind: "missing-repository" }
  | { kind: "missing-run" };

export function normalizeResults(raw: unknown): CheckResult[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const requirementLevel =
        item.requirementLevel === "mandatory" ||
        item.requirementLevel === "recommended" ||
        item.requirementLevel === "informative"
          ? item.requirementLevel
          : undefined;

      return {
        id: typeof item.id === "string" ? item.id : "unknown",
        title: typeof item.title === "string" ? item.title : "Unknown check",
        description: typeof item.description === "string" ? item.description : "",
        requirementLevel,
        confidence:
          item.confidence === "high" ||
          item.confidence === "medium" ||
          item.confidence === "low"
            ? item.confidence
            : undefined,
        status:
          item.status === "pass" ||
          item.status === "warn" ||
          item.status === "fail" ||
          item.status === "info"
            ? item.status
            : "info",
        message:
          typeof item.message === "string" ? item.message : "No detail message available.",
        evidence: Array.isArray(item.evidence)
          ? item.evidence.filter((value): value is string => typeof value === "string")
          : [],
        referenceUrl:
          typeof item.referenceUrl === "string" ? item.referenceUrl : undefined,
        starRating:
          typeof item.starRating === "number" && Number.isInteger(item.starRating) && item.starRating >= 1 && item.starRating <= 5
            ? (item.starRating as StarRating)
            : undefined,
        rating: isRating(item.rating) ? item.rating : undefined,
        mandatoryFrom: isMandatoryFromDate(item.mandatoryFrom) ? item.mandatoryFrom : undefined,
        measurements: parseMeasurements(item.measurements),
        metrics: parseMetrics(item.metrics),
        publiccode: (item.id === "publiccode" && readPublicCodeData(item.publiccode)) || undefined,
        usage: item.id === USAGE_CHECK_ID ? readUsageData(item.usage) : undefined,
        sla: parseSla(item.sla),
        reusedFrom: readReusedFrom(item.reusedFrom),
      } satisfies CheckResult;
    });
}

export function normalizeRepoMeta(raw: RepoMeta | undefined): CheckReport["repoMeta"] {
  const meta = raw ?? ({} as Partial<RepoMeta>);
  const source = meta.versionEvidence?.source;

  return {
    description: meta.description ?? null,
    language: meta.language ?? null,
    stars: meta.stars ?? 0,
    forks: meta.forks ?? 0,
    defaultBranch: meta.defaultBranch ?? "main",
    topics: Array.isArray(meta.topics) ? meta.topics : [],
    license: meta.license ?? null,
    version: meta.version ?? null,
    versionEvidence: {
      source:
        source === "release" ||
        source === "tag" ||
        source === "manifest" ||
        source === "readme" ||
        source === "none"
          ? source
          : "none",
      detail:
        typeof meta.versionEvidence?.detail === "string"
          ? meta.versionEvidence.detail
          : "No saved version evidence for this historical record",
    },
    displayName: meta.displayName ?? null,
    shortDescription: meta.shortDescription ?? null,
    logoUrl: meta.logoUrl ?? null,
    developmentStatus: meta.developmentStatus ?? null,
    maintenanceType: meta.maintenanceType ?? null,
    maintainers: Array.isArray(meta.maintainers) ? meta.maintainers : [],
  };
}

function checklistVersionOf(analysis: unknown): string | null {
  const value = (analysis as { checklistVersion?: unknown }).checklistVersion;
  return typeof value === "string" && value.trim() ? value : null;
}

function checkedAtTime(checkedAt: string): number {
  const time = new Date(checkedAt).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/** The href of a repository page, or of one of its runs. */
export const repositoryRunHref = componentHref;

/**
 * Loads a repository with its stored runs, rated, and selects the requested
 * run, or the latest one when no run is requested.
 */
export async function loadRepositoryRun(
  owner: string,
  repo: string,
  analysisId?: string
): Promise<RepositoryRunResult> {
  let response;
  try {
    response = await dataSource().getRepoHistory(owner, repo, RUN_HISTORY_LIMIT);
  } catch {
    response = null;
  }

  const repository = response?.repository;
  if (!repository) return { kind: "missing-repository" };

  const analyses = [...(response?.analyses ?? [])].sort(
    (a, b) => checkedAtTime(b.checkedAt) - checkedAtTime(a.checkedAt)
  );
  const ratings = await loadStoredRatings(analyses);
  const results = analyses.map((analysis) => normalizeResults(analysis.results));
  const runs: RunSummary[] = analyses.map((analysis, index) => {
    const stored = analysis as typeof analysis & StaticAnalysisExtras & { issueCounts?: { errors: number; warnings: number } };
    const issues =
      results[index].length === 0 && stored.issueCounts
        ? stored.issueCounts
        : countIssues(results[index], ratings[index].rating, ratings[index].endorsement);
    const hasIssues = results[index].length > 0 || stored.issueCounts !== undefined;
    return {
      id: analysis.id,
      checkedAt: analysis.checkedAt,
      version: analysis.version ?? null,
      score: analysis.score,
      rating: ratings[index].rating,
      passed: ratings[index].endorsement.passed,
      errors: hasIssues ? issues.errors : null,
      warnings: hasIssues ? issues.warnings : null,
      declaredUserCount: typeof analysis.declaredUserCount === "number" ? analysis.declaredUserCount : null,
      detailAvailable: stored.detailAvailable !== false,
    };
  });

  const selectedIndex =
    analysisId === undefined ? (analyses.length > 0 ? 0 : -1) : analyses.findIndex((analysis) => analysis.id === analysisId);
  if (analysisId !== undefined && (selectedIndex === -1 || !runs[selectedIndex].detailAvailable)) {
    return { kind: "missing-run" };
  }
  const extras = response?.extras ?? null;

  const selected: SelectedRun | null =
    selectedIndex === -1
      ? null
      : {
          ...runs[selectedIndex],
          results: results[selectedIndex],
          categoryRatings: ratings[selectedIndex].categoryRatings,
          aspectRatings: ratings[selectedIndex].aspectRatings,
          endorsement: ratings[selectedIndex].endorsement,
          checklistVersion: checklistVersionOf(analyses[selectedIndex]),
          scannedRef: analyses[selectedIndex].scannedRef ?? null,
          scannedRefKind: analyses[selectedIndex].scannedRefKind ?? null,
          scannedCommit: analyses[selectedIndex].scannedCommit ?? null,
          scanMode: analyses[selectedIndex].scanMode ?? null,
          scanDurationSeconds: analyses[selectedIndex].scanDurationSeconds ?? null,
        };

  return {
    kind: "found",
    run: {
      repository: {
        id: repository.id,
        owner: repository.owner ?? owner,
        name: repository.name ?? repo,
        repoUrl: repository.repoUrl ?? `https://github.com/${owner}/${repo}`,
        followed: repository.followed ?? false,
        checkIntervalHours: repository.checkIntervalHours ?? null,
        nextCheckAt: repository.nextCheckAt ?? null,
        scanRef: repository.scanRef ?? null,
        retiredAt: repository.retiredAt ?? extras?.retired?.on ?? null,
        retiredReason: repository.retiredReason ?? extras?.retired?.reason ?? null,
      },
      repoMeta: normalizeRepoMeta(repository.metadata),
      runs,
      selected,
      latestId: runs[0]?.id ?? null,
      latest: {
        endorsement: ratings[0]?.endorsement ?? null,
        developmentStatus: developmentStatusOf(analyses[0]?.results ?? []),
      },
      drops: response?.drops ?? [],
      extras,
    },
  };
}

/** The Common Ground status of a loaded repository, with the usage and SLAs the backend stored for it. */
export function lifecycleOfRun(
  run: RepositoryRun,
  options: {
    usage: { declaredUserCount?: number | null; slas?: MaintainedSla[] } | null;
    minUsers: number;
    today: string;
  }
): LifecycleResult {
  return computeLifecycleStatus({
    hasAnalysis: run.runs.length > 0,
    endorsement: run.latest.endorsement,
    developmentStatus: run.latest.developmentStatus,
    declaredUserCount: options.usage?.declaredUserCount ?? null,
    slas: options.usage?.slas ?? [],
    minUsers: options.minUsers,
    today: options.today,
    retiredAt: run.repository.retiredAt,
    retiredReason: run.repository.retiredReason,
    drops: openDropsOf(run.drops),
  });
}
