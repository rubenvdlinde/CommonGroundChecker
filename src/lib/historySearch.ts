export const SEARCH_DEBOUNCE_MS = 300;

interface HistoryHrefOptions {
  q?: string;
  sort: "rating" | "date" | "score";
  direction: "asc" | "desc";
}

/** Trims a search term taken from the URL or the search input. */
export function normalizeSearchQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Builds the History index URL, keeping the sort options and the search term together. */
export function buildHistoryHref({ q, sort, direction }: HistoryHrefOptions): string {
  const params = new URLSearchParams({ sort, direction });
  const term = normalizeSearchQuery(q);
  if (term) params.set("q", term);
  return `/history?${params.toString()}`;
}

interface SearchableRepository {
  owner: string;
  name: string;
  repoUrl: string;
  description?: string | null;
  displayName?: string | null;
  shortDescription?: string | null;
  topics?: string[];
}

/**
 * Whether a repository matches a search term, as the backend's repository
 * search does: owner, name, description or URL contain the term ignoring
 * case, or a topic equals it. The static site also matches the publiccode.yml
 * name and short description, which it has at hand.
 */
export function matchesRepositorySearch(repository: SearchableRepository, query: string): boolean {
  const term = normalizeSearchQuery(query).toLowerCase();
  if (!term) return true;
  const fields = [
    repository.owner,
    repository.name,
    repository.repoUrl,
    repository.description,
    repository.displayName,
    repository.shortDescription,
  ];
  return (
    fields.some((field) => typeof field === "string" && field.toLowerCase().includes(term)) ||
    (repository.topics ?? []).some((topic) => topic.toLowerCase() === term)
  );
}
