import { getRepoHistory } from "@/lib/apiClient";
import { parseMeasurements } from "@/lib/measurements";
import { countIssues } from "@/lib/issues";
import { isRating, type Ratings } from "@/lib/ratings";
import { loadStoredRatings } from "@/lib/storedRatings";
import type { CheckReport, CheckResult, Endorsement, StarRating } from "@/lib/types";
import type { RepoMeta } from "@/generated/openapi-client";

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
}

/** The run a repository page shows in full. */
export interface SelectedRun extends RunSummary {
  results: CheckResult[];
  categoryRatings: Ratings["categoryRatings"];
  aspectRatings: Ratings["aspectRatings"];
  endorsement: Endorsement;
}

export interface RepositoryRun {
  repository: {
    id: string;
    owner: string;
    name: string;
    followed: boolean;
    checkIntervalHours: number | null;
    nextCheckAt: string | null;
  };
  repoMeta: CheckReport["repoMeta"];
  /** Every loaded run, newest first */
  runs: RunSummary[];
  /** The requested run, or the latest one; null when no run is stored */
  selected: SelectedRun | null;
  latestId: string | null;
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
        measurements: parseMeasurements(item.measurements),
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

function checkedAtTime(checkedAt: string): number {
  const time = new Date(checkedAt).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

/** The href of a repository page, or of one of its runs. */
export function repositoryRunHref(owner: string, repo: string, analysisId?: string): string {
  const base = `/history/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return analysisId === undefined ? base : `${base}/${encodeURIComponent(analysisId)}`;
}

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
    response = await getRepoHistory(owner, repo, RUN_HISTORY_LIMIT);
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
    const issues = countIssues(results[index], ratings[index].rating, ratings[index].endorsement);
    return {
      id: analysis.id,
      checkedAt: analysis.checkedAt,
      version: analysis.version ?? null,
      score: analysis.score,
      rating: ratings[index].rating,
      passed: ratings[index].endorsement.passed,
      errors: results[index].length > 0 ? issues.errors : null,
      warnings: results[index].length > 0 ? issues.warnings : null,
    };
  });

  const selectedIndex =
    analysisId === undefined ? (analyses.length > 0 ? 0 : -1) : analyses.findIndex((analysis) => analysis.id === analysisId);
  if (analysisId !== undefined && selectedIndex === -1) return { kind: "missing-run" };

  const selected: SelectedRun | null =
    selectedIndex === -1
      ? null
      : {
          ...runs[selectedIndex],
          results: results[selectedIndex],
          categoryRatings: ratings[selectedIndex].categoryRatings,
          aspectRatings: ratings[selectedIndex].aspectRatings,
          endorsement: ratings[selectedIndex].endorsement,
        };

  return {
    kind: "found",
    run: {
      repository: {
        id: repository.id,
        owner: repository.owner ?? owner,
        name: repository.name ?? repo,
        followed: repository.followed ?? false,
        checkIntervalHours: repository.checkIntervalHours ?? null,
        nextCheckAt: repository.nextCheckAt ?? null,
      },
      repoMeta: normalizeRepoMeta(repository.metadata),
      runs,
      selected,
      latestId: runs[0]?.id ?? null,
    },
  };
}
