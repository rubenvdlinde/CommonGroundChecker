"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RepoSummary } from "@/generated/openapi-client";
import AddComponentPanel from "@/components/AddComponentPanel";
import LifecycleChip, { BasissetChip } from "@/components/LifecycleChip";
import RatingBadge from "@/components/RatingBadge";
import RepoLogo from "@/components/RepoLogo";
import RunStatus, { runStatus } from "@/components/RunStatus";
import { buildHistoryHref, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from "@/lib/historySearch";
import { isRating } from "@/lib/ratings";
import { componentHref } from "@/lib/routes";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import type { Basisset } from "@/lib/basisset";
import { buildHistoryIndex, matchesFilter, statusCounts } from "@/lib/historyIndex";
import { DEFAULT_MIN_USERS } from "@/lib/maintained";
import { LIFECYCLE_SHORT_LABELS, LIFECYCLE_STATUSES, type LifecycleStatus } from "@/lib/lifecycle";

export type SortKey = "rating" | "date" | "score";
export type SortDirection = "asc" | "desc";

interface HistoryPageClientProps {
  sort: SortKey;
  direction: SortDirection;
  query: string;
  repositories: RepoSummary[];
  error?: string;
  /** The status to show, or null for every status */
  status?: LifecycleStatus | null;
  /** Only components in the Common Ground basisset */
  basissetOnly?: boolean;
  /** The Common Ground basisset, or null when it could not be read */
  basisset?: Basisset | null;
  minUsers?: number;
  /** Today as YYYY-MM-DD */
  today?: string;
}

function sortValue(repository: RepoSummary, sortKey: SortKey): number | null {
  const latest = repository.latestAnalysis as { checkedAt: string; score: number; rating?: unknown } | null;
  if (!latest) return null;
  if (sortKey === "date") return new Date(latest.checkedAt).getTime();
  if (sortKey === "score") return latest.score;
  return isRating(latest.rating) ? latest.rating : null;
}

/** Sorts on the latest analysis; repositories without a value for the key come last in either direction. */
export function sortRepositories<T extends RepoSummary>(
  repositories: T[],
  sortKey: SortKey,
  sortDirection: SortDirection
): T[] {
  const sorted = [...repositories];
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    const valueA = sortValue(a, sortKey);
    const valueB = sortValue(b, sortKey);

    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1;
    if (valueB === null) return -1;

    if (valueA === valueB) return 0;
    return valueA > valueB ? directionMultiplier : -directionMultiplier;
  });

  return sorted;
}

const FILTER_CHIP_CLASS =
  "inline-flex items-center min-h-[44px] sm:min-h-[32px] text-xs font-semibold px-3 rounded-full border transition-colors";
const ACTIVE_CHIP_CLASS = "border-cg-lightblue text-cg-blue bg-cg-lightblue/10";
const IDLE_CHIP_CLASS = "border-gray-300 text-gray-600 bg-white hover:border-cg-lightblue hover:text-cg-blue";

/** "status Maintained in the basisset", for the line that counts the matches. */
function filterLabel(status: LifecycleStatus | null, basissetOnly: boolean): string {
  const parts = [status ? `status ${LIFECYCLE_SHORT_LABELS[status]}` : "any status"];
  if (basissetOnly) parts.push("in the basisset");
  return parts.join(" ");
}

const sortOptions: Array<{ label: string; sort: SortKey; direction: SortDirection }> = [
  { label: "Rating ↓", sort: "rating", direction: "desc" },
  { label: "Rating ↑", sort: "rating", direction: "asc" },
  { label: "Date ↑", sort: "date", direction: "asc" },
  { label: "Date ↓", sort: "date", direction: "desc" },
  { label: "Score ↑", sort: "score", direction: "asc" },
  { label: "Score ↓", sort: "score", direction: "desc" },
];

export default function HistoryPageClient({
  sort,
  direction,
  query,
  repositories,
  error,
  status = null,
  basissetOnly = false,
  basisset = null,
  minUsers = DEFAULT_MIN_USERS,
  today = new Date().toISOString().slice(0, 10),
}: HistoryPageClientProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(query);
  const requestedQuery = useRef(query);

  const entries = useMemo(
    () => buildHistoryIndex(repositories, { basisset, minUsers, today }),
    [repositories, basisset, minUsers, today]
  );
  const counts = useMemo(() => statusCounts(entries, basissetOnly), [entries, basissetOnly]);
  const sortedRepositories = useMemo(
    () => sortRepositories(entries.filter((entry) => matchesFilter(entry, { status, basisset: basissetOnly })), sort, direction),
    [entries, status, basissetOnly, sort, direction]
  );
  const filtered = status !== null || basissetOnly;
  const hrefWith = (options: { q?: string; sort?: SortKey; direction?: SortDirection; status?: LifecycleStatus | null; basisset?: boolean }) =>
    buildHistoryHref({
      q: options.q ?? query,
      sort: options.sort ?? sort,
      direction: options.direction ?? direction,
      status: options.status === undefined ? status : options.status,
      basisset: options.basisset ?? basissetOnly,
    });

  // A query that this component did not request came from navigation, so the input follows it.
  useEffect(() => {
    if (query !== requestedQuery.current) {
      requestedQuery.current = query;
      setSearchValue(query);
    }
  }, [query]);

  useEffect(() => {
    const term = normalizeSearchQuery(searchValue);
    if (term === requestedQuery.current) return;

    const timer = setTimeout(() => {
      requestedQuery.current = term;
      router.replace(buildHistoryHref({ q: term, sort, direction, status, basisset: basissetOnly }), { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchValue, sort, direction, status, basissetOnly, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = normalizeSearchQuery(searchValue);
    requestedQuery.current = term;
    router.replace(buildHistoryHref({ q: term, sort, direction, status, basisset: basissetOnly }), { scroll: false });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Components</h2>
        <p className="text-gray-600">
          Every component the checker has rated. Select one to see its rating, its Common Ground status and every run
          over time.
        </p>
        <form
          role="search"
          method="get"
          action="/components"
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-2 pt-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="history-search" className="text-xs font-semibold text-gray-700">
              Search components
            </label>
            <input
              id="history-search"
              type="search"
              name="q"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Owner, name, description or topic"
              className="w-72 max-w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:border-cg-lightblue focus:outline-none focus:ring-2 focus:ring-cg-lightblue/40"
            />
          </div>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="direction" value={direction} />
          {status && <input type="hidden" name="status" value={status} />}
          {basissetOnly && <input type="hidden" name="basisset" value="1" />}
          <button
            type="submit"
            className="rounded-lg border border-cg-lightblue bg-cg-lightblue/10 px-3 py-1.5 text-sm font-semibold text-cg-blue hover:bg-cg-lightblue/20"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Sort by:</span>
          {sortOptions.map((option) => {
            const isActive = option.sort === sort && option.direction === direction;
            return (
              <Link
                key={`${option.sort}-${option.direction}`}
                href={hrefWith({ sort: option.sort, direction: option.direction })}
                aria-current={isActive ? "true" : undefined}
                className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  isActive
                    ? "border-cg-lightblue text-cg-blue bg-cg-lightblue/10"
                    : "border-gray-300 text-gray-600 bg-white hover:border-cg-lightblue hover:text-cg-blue"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        <div role="group" aria-label="Filter by Common Ground status" className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Status:</span>
          {[null, ...LIFECYCLE_STATUSES].map((option) => {
            const isActive = option === status;
            const count = option === null ? counts.all : counts.byStatus[option];
            return (
              <Link
                key={option ?? "all"}
                href={hrefWith({ status: option })}
                aria-current={isActive ? "true" : undefined}
                className={`${FILTER_CHIP_CLASS} ${isActive ? ACTIVE_CHIP_CLASS : IDLE_CHIP_CLASS}`}
              >
                {option === null ? "All" : LIFECYCLE_SHORT_LABELS[option]} ({count})
              </Link>
            );
          })}
          <Link
            href={hrefWith({ basisset: !basissetOnly })}
            aria-current={basissetOnly ? "true" : undefined}
            className={`${FILTER_CHIP_CLASS} ${basissetOnly ? ACTIVE_CHIP_CLASS : IDLE_CHIP_CLASS}`}
          >
            In basisset ({counts.basisset})
          </Link>
          <Link
            href="/basisset"
            className="inline-flex items-center min-h-[44px] sm:min-h-[32px] text-xs text-cg-lightblue hover:underline"
          >
            About the basisset
          </Link>
        </div>
        <div className="pt-2">
          <a
            href={IS_STATIC_SITE ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/index.json` : "/api/repositories/export"}
            className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-cg-lightblue text-cg-blue bg-cg-lightblue/10 hover:border-cg-blue hover:bg-cg-lightblue/20"
          >
            {IS_STATIC_SITE ? "Download JSON" : "Download CSV"}
          </a>
        </div>
        <p className="text-xs text-gray-500 max-w-2xl">
          {IS_STATIC_SITE
            ? "Downloads the index of this site: the most recent scan result for each followed repository."
            : "Downloads a CSV export containing the most recent scan result for each analyzed repository."}
        </p>
        {IS_STATIC_SITE && <AddComponentPanel compact />}
      </section>

      <section
        aria-label="Repositories"
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
      >
        {(query || filtered) && !error && sortedRepositories.length > 0 && (
          <p role="status" className="text-xs text-gray-500 mb-3">
            {sortedRepositories.length} {sortedRepositories.length === 1 ? "repository matches" : "repositories match"}
            {query ? ` “${query}”` : ""}
            {filtered ? ` with ${filterLabel(status, basissetOnly)}` : ""}.
          </p>
        )}
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : sortedRepositories.length === 0 ? (
          <p role="status" className="text-sm text-gray-500">
            {filtered && entries.length > 0
              ? `No repositories${query ? ` match “${query}”` : ""} with ${filterLabel(status, basissetOnly)}.`
              : query
              ? `No repositories match “${query}”.`
              : "No repositories analyzed yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {sortedRepositories.map((repository) => {
              const latest = repository.latestAnalysis as { checkedAt: string; score: number; rating?: unknown } | null;
              const fullName = `${repository.owner}/${repository.name}`;
              const displayName = repository.displayName ?? fullName;
              const status = runStatus(latest);

              return (
                <Link
                  key={repository.id}
                  href={componentHref(repository.owner, repository.name)}
                  className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-cg-lightblue hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <RepoLogo logoUrl={repository.logoUrl ?? null} name={displayName} size={40} />
                      <div>
                        <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-gray-800">
                          <span>{displayName}</span>
                          {latest && isRating(latest.rating) && <RatingBadge rating={latest.rating} />}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2">
                          <LifecycleChip status={repository.lifecycle.status} />
                          {repository.basisset.entries.length > 0 && (
                            <BasissetChip inBasisset={repository.basisset.entries.some((entry) => entry.inBasisset)} />
                          )}
                        </p>
                        {repository.lifecycle.note && (
                          <p className="text-xs text-amber-900">{repository.lifecycle.note}</p>
                        )}
                        {repository.displayName && (
                          <p className="text-xs text-gray-600">{fullName}</p>
                        )}
                        {repository.shortDescription && (
                          <p className="text-sm text-gray-600">{repository.shortDescription}</p>
                        )}
                        <p className="text-xs text-gray-500">{repository.repoUrl}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{repository.analysisCount} analyses</p>
                      {(repository.openDropCount ?? 0) > 0 && (
                        <p className={(repository.overdueDropCount ?? 0) > 0 ? "font-semibold text-red-700" : "text-amber-800"}>
                          {repository.openDropCount} open {repository.openDropCount === 1 ? "drop" : "drops"}
                          {(repository.overdueDropCount ?? 0) > 0 && `, ${repository.overdueDropCount} overdue`}
                        </p>
                      )}
                      {latest && (
                        <p>
                          Last: {new Date(latest.checkedAt).toLocaleString("nl-NL")}
                        </p>
                      )}
                      {repository.followed && repository.nextCheckAt && (
                        <p>
                          Next check: {new Date(repository.nextCheckAt).toLocaleString("nl-NL")}
                        </p>
                      )}
                    </div>
                  </div>
                  {(latest || repository.followed) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {status && <RunStatus status={status} />}
                      {repository.followed && (
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-green-300 text-green-800 bg-green-50">
                          Followed
                        </span>
                      )}
                      {latest && (
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50">
                          Version: unknown
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
