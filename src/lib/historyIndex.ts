import type { RepoSummary } from "@/generated/openapi-client";
import { isInBasisset, matchBasisset, type Basisset, type BasissetMatch } from "./basisset";
import {
  LIFECYCLE_STATUSES,
  computeLifecycleStatus,
  isLifecycleStatus,
  type LifecycleResult,
  type LifecycleStatus,
} from "./lifecycle";
import type { MaintainedSla } from "./maintained";
import { isRating } from "./ratings";
import type { Endorsement } from "./types";

/**
 * One repository on the History index, in a JSON-serialisable shape: the
 * backend's summary with its Common Ground status, its basisset match, and
 * the rating, verdict and version of the latest analysis.
 */
export interface HistoryIndexEntry extends RepoSummary {
  lifecycle: LifecycleResult;
  basisset: BasissetMatch;
  rating: number | null;
  /** Whether the verdict "Suitable for Common Ground" holds; null without an analysis that stored one */
  verdict: boolean | null;
  version: string | null;
}

export interface HistoryIndexOptions {
  basisset: Basisset | null;
  minUsers: number;
  /** Today as YYYY-MM-DD */
  today: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function endorsementOf(value: unknown): Endorsement | null {
  const endorsement = asObject(value);
  if (!endorsement || typeof endorsement.passed !== "boolean") return null;
  const reasons = Array.isArray(endorsement.reasons)
    ? endorsement.reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
  return { passed: endorsement.passed, reasons };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function slasOf(value: unknown): MaintainedSla[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const sla = asObject(item);
    if (!sla || typeof sla.until !== "string") return [];
    return [
      {
        party: String(sla.party ?? ""),
        maintainer: String(sla.maintainer ?? ""),
        startsOn: String(sla.startsOn ?? ""),
        until: sla.until,
        link: typeof sla.link === "string" ? sla.link : null,
      },
    ];
  });
}

/** The History index entry of one repository. */
export function toHistoryIndexEntry(repository: RepoSummary, options: HistoryIndexOptions): HistoryIndexEntry {
  const summary = repository as RepoSummary & Record<string, unknown>;
  const latest = asObject(repository.latestAnalysis);
  const endorsement = endorsementOf(latest?.endorsement);
  const version = stringOrNull(latest?.version);
  const declaredUserCount = typeof latest?.declaredUserCount === "number" ? latest.declaredUserCount : null;

  const lifecycle = computeLifecycleStatus({
    hasAnalysis: latest !== null,
    endorsement,
    developmentStatus: stringOrNull(latest?.developmentStatus) ?? stringOrNull(summary.developmentStatus),
    declaredUserCount,
    slas: slasOf(summary.slas),
    minUsers: options.minUsers,
    today: options.today,
    retiredAt: stringOrNull(summary.retiredAt),
    retiredReason: stringOrNull(summary.retiredReason),
    drops: {
      open: typeof summary.openDropCount === "number" ? summary.openDropCount : 0,
      overdue: typeof summary.overdueDropCount === "number" ? summary.overdueDropCount : 0,
      nextFixBy: stringOrNull(summary.nextFixBy),
    },
  });

  return {
    ...repository,
    lifecycle,
    basisset: matchBasisset(options.basisset, repository.repoUrl, version),
    rating: isRating(latest?.rating) ? (latest.rating as number) : null,
    verdict: endorsement ? endorsement.passed : null,
    version,
  };
}

export function buildHistoryIndex(repositories: RepoSummary[], options: HistoryIndexOptions): HistoryIndexEntry[] {
  return repositories.map((repository) => toHistoryIndexEntry(repository, options));
}

/** The status filter of the History index: one status or every status, and whether only basisset components show. */
export interface HistoryFilter {
  status: LifecycleStatus | null;
  basisset: boolean;
}

/** Reads `?status=` and `?basisset=1`; an unknown status shows every status. */
export function parseHistoryFilter(status: string | undefined, basisset: string | undefined): HistoryFilter {
  const value = status?.trim().toLowerCase();
  return { status: isLifecycleStatus(value) ? value : null, basisset: basisset === "1" || basisset === "true" };
}

/** Whether an entry shows under the filter. */
export function matchesFilter(entry: Pick<HistoryIndexEntry, "lifecycle" | "basisset">, filter: HistoryFilter): boolean {
  if (filter.status && entry.lifecycle?.status !== filter.status) return false;
  if (filter.basisset && !isInBasisset(entry.basisset)) return false;
  return true;
}

/** How many entries have each status, and how many are in the basisset, under the basisset part of the filter. */
export function statusCounts(
  entries: Array<Pick<HistoryIndexEntry, "lifecycle" | "basisset">>,
  basissetOnly: boolean
): { all: number; byStatus: Record<LifecycleStatus, number>; basisset: number } {
  const byStatus = Object.fromEntries(LIFECYCLE_STATUSES.map((status) => [status, 0])) as Record<LifecycleStatus, number>;
  let all = 0;
  for (const entry of entries) {
    if (basissetOnly && !isInBasisset(entry.basisset)) continue;
    all += 1;
    if (entry.lifecycle) byStatus[entry.lifecycle.status] += 1;
  }
  return { all, byStatus, basisset: entries.filter((entry) => isInBasisset(entry.basisset)).length };
}
