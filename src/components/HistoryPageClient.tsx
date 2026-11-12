"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RepoSummary } from "@/generated/openapi-client";
import RatingBadge from "@/components/RatingBadge";
import { isRating } from "@/lib/ratings";
import RepoLogo from "@/components/RepoLogo";
import { buildHistoryHref, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from "@/lib/historySearch";

export type SortKey = "rating" | "date" | "score";
export type SortDirection = "asc" | "desc";

interface HistoryPageClientProps {
  sort: SortKey;
  direction: SortDirection;
  query: string;
  repositories: RepoSummary[];
  error?: string;
}

function sortValue(repository: RepoSummary, sortKey: SortKey): number | null {
  const latest = repository.latestAnalysis as { checkedAt: string; score: number; rating?: unknown } | null;
  if (!latest) return null;
  if (sortKey === "date") return new Date(latest.checkedAt).getTime();
  if (sortKey === "score") return latest.score;
  return isRating(latest.rating) ? latest.rating : null;
}

/** Sorts on the latest analysis; repositories without a value for the key come last in either direction. */
export function sortRepositories(
  repositories: RepoSummary[],
  sortKey: SortKey,
  sortDirection: SortDirection
): RepoSummary[] {
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
}: HistoryPageClientProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(query);
  const requestedQuery = useRef(query);

  const sortedRepositories = useMemo(
    () => sortRepositories(repositories, sort, direction),
    [repositories, sort, direction]
  );

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
      router.replace(buildHistoryHref({ q: term, sort, direction }), { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchValue, sort, direction, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = normalizeSearchQuery(searchValue);
    requestedQuery.current = term;
    router.replace(buildHistoryHref({ q: term, sort, direction }), { scroll: false });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Analyzed Repositories</h2>
        <p className="text-gray-600">
          Select a repository to view metadata and historical analyses over time.
        </p>
        <form
          role="search"
          method="get"
          action="/history"
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-2 pt-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="history-search" className="text-xs font-semibold text-gray-700">
              Search repositories
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
                href={buildHistoryHref({ q: query, sort: option.sort, direction: option.direction })}
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
        <div className="pt-2">
          <a
            href="/api/repositories/export"
            className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-cg-lightblue text-cg-blue bg-cg-lightblue/10 hover:border-cg-blue hover:bg-cg-lightblue/20"
          >
            Download CSV
          </a>
        </div>
        <p className="text-xs text-gray-500 max-w-2xl">
          Downloads a CSV export containing the most recent scan result for each analyzed repository.
        </p>
      </section>

      <section
        aria-label="Repositories"
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
      >
        {query && !error && sortedRepositories.length > 0 && (
          <p role="status" className="text-xs text-gray-500 mb-3">
            {sortedRepositories.length} {sortedRepositories.length === 1 ? "repository matches" : "repositories match"} “{query}”.
          </p>
        )}
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : sortedRepositories.length === 0 ? (
          <p role="status" className="text-sm text-gray-500">
            {query ? `No repositories match “${query}”.` : "No repositories analyzed yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {sortedRepositories.map((repository) => {
              const latest = repository.latestAnalysis as { checkedAt: string; score: number; rating?: unknown } | null;
              const fullName = `${repository.owner}/${repository.name}`;
              const displayName = repository.displayName ?? fullName;

              return (
                <Link
                  key={repository.id}
                  href={`/history/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}
                  className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-cg-lightblue hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                      <RepoLogo logoUrl={repository.logoUrl ?? null} name={displayName} size={40} />
                      <div>
                        <p className="font-semibold text-gray-800">
                          {displayName}
                          {repository.followed && (
                            <span className="inline-flex ml-2 align-middle text-xs font-semibold px-2 py-0.5 rounded-full border border-green-300 text-green-800 bg-green-50">
                              Followed
                            </span>
                          )}
                        </p>
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
                  {latest && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isRating(latest.rating) && <RatingBadge rating={latest.rating} />}
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-300 text-gray-700 bg-white">
                        Latest score: {latest.score}
                      </span>
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50">
                        Version: unknown
                      </span>
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
