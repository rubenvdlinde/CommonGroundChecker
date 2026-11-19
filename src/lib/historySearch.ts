import { COMPONENTS_PATH } from "@/lib/routes";

export const SEARCH_DEBOUNCE_MS = 300;

interface HistoryHrefOptions {
  q?: string;
  sort: "rating" | "date" | "score";
  direction: "asc" | "desc";
  /** A lifecycle status to filter on, or null for every status */
  status?: string | null;
  /** Only components in the Common Ground basisset */
  basisset?: boolean;
  /** Only components that list this functionality */
  functionality?: string | null;
  /** Only components that declare or implement this standard */
  standard?: string | null;
}

/** Trims a search term taken from the URL or the search input. */
export function normalizeSearchQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Builds the Components index URL, keeping the sort options, the search term and the filters together. */
export function buildHistoryHref({ q, sort, direction, status, basisset, functionality, standard }: HistoryHrefOptions): string {
  const params = new URLSearchParams({ sort, direction });
  const term = normalizeSearchQuery(q);
  if (term) params.set("q", term);
  if (status) params.set("status", status);
  if (basisset) params.set("basisset", "1");
  if (functionality) params.set("functionality", functionality);
  if (standard) params.set("standard", standard);
  return `${COMPONENTS_PATH}?${params.toString()}`;
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
