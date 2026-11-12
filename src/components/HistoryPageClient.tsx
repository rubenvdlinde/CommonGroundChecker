"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { RepoSummary } from "@/generated/openapi-client";
import RatingBadge from "@/components/RatingBadge";
import { isRating } from "@/lib/ratings";
import RepoLogo from "@/components/RepoLogo";

type SortKey = "date" | "score";
type SortDirection = "asc" | "desc";

interface HistoryPageClientProps {
  sort: SortKey;
  direction: SortDirection;
  repositories: RepoSummary[];
  error?: string;
}

function sortRepositories(
  repositories: RepoSummary[],
  sortKey: SortKey,
  sortDirection: SortDirection
): RepoSummary[] {
  const sorted = [...repositories];
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    const latestA = a.latestAnalysis as { checkedAt: string; score: number } | null;
    const latestB = b.latestAnalysis as { checkedAt: string; score: number } | null;

    if (!latestA && !latestB) return 0;
    if (!latestA) return 1;
    if (!latestB) return -1;

    const valueA =
      sortKey === "date"
        ? new Date(latestA.checkedAt).getTime()
        : latestA.score;
    const valueB =
      sortKey === "date"
        ? new Date(latestB.checkedAt).getTime()
        : latestB.score;

    if (valueA === valueB) return 0;
    return valueA > valueB ? directionMultiplier : -directionMultiplier;
  });

  return sorted;
}

const sortOptions: Array<{ label: string; sort: SortKey; direction: SortDirection }> = [
  { label: "Date ↑", sort: "date", direction: "asc" },
  { label: "Date ↓", sort: "date", direction: "desc" },
  { label: "Score ↑", sort: "score", direction: "asc" },
  { label: "Score ↓", sort: "score", direction: "desc" },
];

export default function HistoryPageClient({
  sort,
  direction,
  repositories,
  error,
}: HistoryPageClientProps) {
  const sortedRepositories = useMemo(
    () => sortRepositories(repositories, sort, direction),
    [repositories, sort, direction]
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Analyzed Repositories</h2>
        <p className="text-gray-600">
          Select a repository to view metadata and historical analyses over time.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Sort by:</span>
          {sortOptions.map((option) => {
            const isActive = option.sort === sort && option.direction === direction;
            return (
              <Link
                key={`${option.sort}-${option.direction}`}
                href={`/history?sort=${option.sort}&direction=${option.direction}`}
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

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : sortedRepositories.length === 0 ? (
          <p className="text-sm text-gray-500">No repositories analyzed yet.</p>
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
                        <p className="font-semibold text-gray-800">{displayName}</p>
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
