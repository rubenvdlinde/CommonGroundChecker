import { userHref } from "@/lib/routes";
import type { OrganisationSummary } from "@/generated/openapi-client";

/**
 * Organisations come from the users that components declare under `usedBy`
 * in publiccode.yml. The backend groups names that are equal after trimming,
 * collapsing whitespace and ignoring case, the same key as here.
 */
export function organisationKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The Users page of an organisation that uses components. */
export const organisationHref = userHref;

/** The slug of every listed organisation by its key, to link a declared name to its page. */
export function organisationSlugsByKey(organisations: OrganisationSummary[]): Map<string, string> {
  return new Map(organisations.map((organisation) => [organisationKey(organisation.name), organisation.slug]));
}

function searchable(value: string): string {
  return organisationKey(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** The organisations whose name contains the query, ignoring case and accents; all of them for an empty query. */
export function filterOrganisations(organisations: OrganisationSummary[], query: string): OrganisationSummary[] {
  const term = searchable(query);
  if (!term) return organisations;
  return organisations.filter((organisation) => searchable(organisation.name).includes(term));
}

export function componentCountLabel(count: number): string {
  return `${count} ${count === 1 ? "component" : "components"}`;
}
