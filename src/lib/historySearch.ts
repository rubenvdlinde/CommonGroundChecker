export const SEARCH_DEBOUNCE_MS = 300;

interface HistoryHrefOptions {
  q?: string;
  sort: "date" | "score";
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
