"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { RepoSummary } from "@/generated/openapi-client";
import HistoryPageClient, { type SortDirection, type SortKey } from "@/components/HistoryPageClient";
import { matchesRepositorySearch, normalizeSearchQuery } from "@/lib/historySearch";

/** Sort and direction from the URL; without a sort the highest-rated components come first. */
export function readHistoryParams(params: { get(name: string): string | null }): {
  sort: SortKey;
  direction: SortDirection;
  query: string;
} {
  const sort = params.get("sort");
  return {
    sort: sort === "score" || sort === "date" ? sort : "rating",
    direction: params.get("direction") === "asc" ? "asc" : "desc",
    query: normalizeSearchQuery(params.get("q") ?? undefined),
  };
}

/**
 * The History index of the static site. Every repository is in the page;
 * search and sort run in the browser on the same URL parameters as the
 * server's History index.
 */
export default function StaticHistoryIndex({ repositories }: { repositories: RepoSummary[] }) {
  const { sort, direction, query } = readHistoryParams(useSearchParams());
  const matching = useMemo(
    () => repositories.filter((repository) => matchesRepositorySearch(repository as Parameters<typeof matchesRepositorySearch>[0], query)),
    [repositories, query]
  );
  return <HistoryPageClient sort={sort} direction={direction} query={query} repositories={matching} />;
}
