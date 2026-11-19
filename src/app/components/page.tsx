import type { Metadata } from "next";
import { Suspense } from "react";
import HistoryPageClient, { type SortDirection, type SortKey } from "@/components/HistoryPageClient";
import StaticHistoryIndex from "@/components/StaticHistoryIndex";
import type { RepoSummary } from "@/lib/apiClient";
import { loadBasisset } from "@/lib/basisset";
import { dataSource } from "@/lib/dataSource";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { parseHistoryFilter } from "@/lib/historyIndex";
import { normalizeSearchQuery } from "@/lib/historySearch";
import { minUsers } from "@/lib/maintained";

export const metadata: Metadata = {
  title: "Components | Common Ground Component Checker",
};

interface HistoryHomePageProps {
  searchParams: Promise<{
    sort?: string | string[];
    direction?: string | string[];
    q?: string | string[];
    status?: string | string[];
    basisset?: string | string[];
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
    const [repositories, basisset] = await Promise.all([dataSource().listRepositories(), loadBasisset()]);
    const today = new Date().toISOString().slice(0, 10);
    const indexProps = { repositories, basisset, minUsers: minUsers(), today };
    return (
      <Suspense fallback={<HistoryPageClient sort="rating" direction="desc" query="" {...indexProps} />}>
        <StaticHistoryIndex {...indexProps} />
      </Suspense>
    );
  }

  const query = await searchParams;
  const sortKey = normalizeSortKey(firstValue(query.sort));
  const sortDirection = normalizeSortDirection(firstValue(query.direction));
  const searchQuery = normalizeSearchQuery(query.q);
  const filter = parseHistoryFilter(firstValue(query.status), firstValue(query.basisset));

  let repositories: RepoSummary[] = [];
  let error: string | undefined;

  const basissetLoad = loadBasisset();
  try {
    repositories = await dataSource().listRepositories({ limit: 50, q: searchQuery });
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to connect to the components API.";
  }
  const basisset = await basissetLoad;

  return (
    <HistoryPageClient
      sort={sortKey}
      direction={sortDirection}
      query={searchQuery}
      repositories={repositories}
      error={error}
      status={filter.status}
      basissetOnly={filter.basisset}
      basisset={basisset}
      minUsers={minUsers()}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
