export const SEARCH_DEBOUNCE_MS = 300;

interface HistoryHrefOptions {
  q?: string;
  sort: "rating" | "date" | "score";
  direction: "asc" | "desc";
  /** A lifecycle status to filter on, or null for every status */
  status?: string | null;
  /** Only components in the Common Ground basisset */
  basisset?: boolean;
}

/** Trims a search term taken from the URL or the search input. */
export function normalizeSearchQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Builds the History index URL, keeping the sort options, the search term and the status filter together. */
export function buildHistoryHref({ q, sort, direction, status, basisset }: HistoryHrefOptions): string {
  const params = new URLSearchParams({ sort, direction });
  const term = normalizeSearchQuery(q);
  if (term) params.set("q", term);
  if (status) params.set("status", status);
  if (basisset) params.set("basisset", "1");
  return `/history?${params.toString()}`;
}
