import HistoryPageClient, { type SortDirection, type SortKey } from "@/components/HistoryPageClient";
import { getRepositories, type RepoSummary } from "@/lib/apiClient";
import { loadBasisset } from "@/lib/basisset";
import { parseHistoryFilter } from "@/lib/historyIndex";
import { normalizeSearchQuery } from "@/lib/historySearch";
import { minUsers } from "@/lib/maintained";

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
  const query = await searchParams;
  const sortKey = normalizeSortKey(firstValue(query.sort));
  const sortDirection = normalizeSortDirection(firstValue(query.direction));
  const searchQuery = normalizeSearchQuery(query.q);
  const filter = parseHistoryFilter(firstValue(query.status), firstValue(query.basisset));

  let repositories: RepoSummary[] = [];
  let error: string | undefined;

  const basissetLoad = loadBasisset();
  try {
    repositories = await getRepositories(50, searchQuery);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to connect to repository history API.";
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
