/** The data of the functionality pages, in both modes read when the page is built or rendered. */
import type { RepoSummary } from "@/generated/openapi-client";
import { dataSource } from "@/lib/dataSource";
import { loadLandscapeComponents, loadTaxonomy } from "./load";
import { buildLandscape, type LandscapeEntry } from "./overlap";
import type { FunctionalityTaxonomy } from "./taxonomy";

/** The components the data source lists; none when it cannot be read, so the page still renders from the config. */
export async function listRepositoriesOrNone(): Promise<RepoSummary[]> {
  try {
    return await dataSource().listRepositories({ limit: 50 });
  } catch {
    return [];
  }
}

export interface FunctionalityLandscape {
  taxonomy: FunctionalityTaxonomy;
  entries: LandscapeEntry[];
  /** owner/repo of the components that have a page */
  analysed: Set<string>;
  /** How many components list functionalities, and how many of those lists are drafts */
  mapped: number;
  drafts: number;
}

export async function loadFunctionalityLandscape(): Promise<FunctionalityLandscape> {
  const [taxonomy, repositories] = await Promise.all([
    loadTaxonomy(),
    listRepositoriesOrNone(),
  ]);
  const components = await loadLandscapeComponents(repositories);
  return {
    taxonomy,
    entries: buildLandscape(taxonomy, components),
    analysed: new Set(components.filter((component) => component.analysed).map((component) => `${component.owner}/${component.name}`)),
    mapped: components.length,
    drafts: components.filter((component) => component.draft).length,
  };
}
