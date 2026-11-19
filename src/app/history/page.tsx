import { Suspense } from "react";
import HistoryPageClient, { type SortDirection, type SortKey } from "@/components/HistoryPageClient";
import StaticHistoryIndex from "@/components/StaticHistoryIndex";
import type { RepoSummary } from "@/lib/apiClient";
import { dataSource } from "@/lib/dataSource";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { normalizeSearchQuery } from "@/lib/historySearch";

interface HistoryHomePageProps {
  searchParams: Promise<{
    sort?: string | string[];
    direction?: string | string[];
    q?: string | string[];
  }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Without a sort in the URL, the highest-rated components come first. */
function normalizeSortKey(value: string | undefined): SortKey {
  return value === "score" || value === "date" ? value : "rating";
}

function normalizeSortDirection(value: string | undefined): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

export default async function HistoryHomePage({ searchParams }: HistoryHomePageProps) {
  if (IS_STATIC_SITE) {
    const repositories = await dataSource().listRepositories();
    return (
      <Suspense fallback={<HistoryPageClient sort="rating" direction="desc" query="" repositories={repositories} />}>
        <StaticHistoryIndex repositories={repositories} />
      </Suspense>
    );
  }

  const query = await searchParams;
  const sortKey = normalizeSortKey(firstValue(query.sort));
  const sortDirection = normalizeSortDirection(firstValue(query.direction));
  const searchQuery = normalizeSearchQuery(query.q);

  let repositories: RepoSummary[] = [];
  let error: string | undefined;

  try {
    repositories = await dataSource().listRepositories({ limit: 50, q: searchQuery });
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to connect to repository history API.";
  }

  return (
    <HistoryPageClient
      sort={sortKey}
      direction={sortDirection}
      query={searchQuery}
      repositories={repositories}
      error={error}
    />
  );
}
