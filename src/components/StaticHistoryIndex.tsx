"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { RepoSummary } from "@/generated/openapi-client";
import HistoryPageClient, { type SortDirection, type SortKey } from "@/components/HistoryPageClient";
import type { Basisset } from "@/lib/basisset";
import { parseHistoryFilter, type HistoryFilter } from "@/lib/historyIndex";
import { matchesRepositorySearch, normalizeSearchQuery } from "@/lib/historySearch";

/** Sort, direction, search and filter from the URL; without a sort the highest-rated components come first. */
export function readHistoryParams(params: { get(name: string): string | null }): {
  sort: SortKey;
  direction: SortDirection;
  query: string;
  filter: HistoryFilter;
} {
  const sort = params.get("sort");
  return {
    sort: sort === "score" || sort === "date" ? sort : "rating",
    direction: params.get("direction") === "asc" ? "asc" : "desc",
    query: normalizeSearchQuery(params.get("q") ?? undefined),
    filter: parseHistoryFilter(params.get("status") ?? undefined, params.get("basisset") ?? undefined),
  };
}

interface StaticHistoryIndexProps {
  repositories: RepoSummary[];
  /** The Common Ground basisset as read at build time, or null when it could not be read */
  basisset?: Basisset | null;
  minUsers?: number;
  /** The build day as YYYY-MM-DD */
  today?: string;
}

/**
 * The Components index of the static site. Every repository is in the page;
 * search, sort and the status filter run in the browser on the same URL
 * parameters as the server's Components index.
 */
export default function StaticHistoryIndex({ repositories, basisset = null, minUsers, today }: StaticHistoryIndexProps) {
  const { sort, direction, query, filter } = readHistoryParams(useSearchParams());
  const matching = useMemo(
    () => repositories.filter((repository) => matchesRepositorySearch(repository as Parameters<typeof matchesRepositorySearch>[0], query)),
    [repositories, query]
  );
  return (
    <HistoryPageClient
      sort={sort}
      direction={direction}
      query={query}
      repositories={matching}
      status={filter.status}
      basissetOnly={filter.basisset}
      basisset={basisset}
      minUsers={minUsers}
      today={today}
    />
  );
}
