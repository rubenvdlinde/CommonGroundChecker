/** Reads config/functionalities.yml when the site is built or a page is rendered on the server. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repositoriesFile } from "@/lib/serviceProviders";
import { normalizeRepositoryUrl, parseYaml, repositoryPath } from "@/lib/staticSite/config";
import type { LandscapeComponent } from "./overlap";
import { EMPTY_TAXONOMY, readTaxonomy, type FunctionalityTaxonomy } from "./taxonomy";

/** config/functionalities.yml, or the file CGC_FUNCTIONALITIES_FILE names. */
export function functionalitiesFile(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.CGC_FUNCTIONALITIES_FILE || "config/functionalities.yml");
}

/** The taxonomy; empty when the file does not exist. */
export async function loadTaxonomy(file: string = functionalitiesFile()): Promise<FunctionalityTaxonomy> {
  try {
    return readTaxonomy(parseYaml(await readFile(file, "utf-8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_TAXONOMY;
    throw err;
  }
}

export interface ListedFunctionalities {
  functionalities: string[];
  functionalitiesDraft: boolean;
}

/** The functionalities each component lists in the component list, by lower-case normalised repository URL. */
export function functionalitiesByRepository(raw: unknown): Map<string, ListedFunctionalities> {
  const list = raw && typeof raw === "object" ? (raw as { repositories?: unknown }).repositories : undefined;
  const result = new Map<string, ListedFunctionalities>();
  if (!Array.isArray(list)) return result;
  for (const item of list) {
    const entry = (item ?? {}) as Record<string, unknown>;
    if (typeof entry.url !== "string") continue;
    let key: string;
    try {
      key = normalizeRepositoryUrl(entry.url).toLowerCase();
    } catch {
      continue;
    }
    const ids = Array.isArray(entry.functionalities)
      ? entry.functionalities.filter((id): id is string => typeof id === "string")
      : [];
    result.set(key, { functionalities: ids, functionalitiesDraft: entry.functionalitiesDraft === true });
  }
  return result;
}

/** The functionalities of every component in config/repositories.yml; empty when the file does not exist. */
export async function loadListedFunctionalities(file: string = repositoriesFile()): Promise<Map<string, ListedFunctionalities>> {
  try {
    return functionalitiesByRepository(parseYaml(await readFile(file, "utf-8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
}

/** The functionalities a repository lists; none for a repository the component list does not name. */
export function listedFunctionalitiesOf(
  listed: Map<string, ListedFunctionalities>,
  repoUrl: string
): ListedFunctionalities {
  try {
    return listed.get(normalizeRepositoryUrl(repoUrl).toLowerCase()) ?? { functionalities: [], functionalitiesDraft: false };
  } catch {
    return { functionalities: [], functionalitiesDraft: false };
  }
}

/** The repositories with the functionalities of the component list added. */
export function withListedFunctionalities<T extends { repoUrl: string }>(
  repositories: T[],
  listed: Map<string, ListedFunctionalities>
): Array<T & ListedFunctionalities> {
  return repositories.map((repository) => ({ ...repository, ...listedFunctionalitiesOf(listed, repository.repoUrl) }));
}

/** The components of the component list that list functionalities, named as the data names them. */
export async function loadLandscapeComponents(
  repositories: Array<{ owner: string; name: string; repoUrl: string; displayName?: string | null; latestAnalysis?: unknown }>,
  file: string = repositoriesFile()
): Promise<Array<LandscapeComponent & { analysed: boolean }>> {
  let raw: unknown;
  try {
    raw = parseYaml(await readFile(file, "utf-8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const byUrl = new Map(
    repositories.map((repository) => [normalizeRepositoryUrl(repository.repoUrl).toLowerCase(), repository])
  );
  const list = (raw as { repositories?: unknown }).repositories;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    if (typeof entry.url !== "string" || entry.retired) return [];
    const ids = Array.isArray(entry.functionalities)
      ? entry.functionalities.filter((id): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) return [];
    let location;
    try {
      location = repositoryPath(entry.url);
    } catch {
      return [];
    }
    const data = byUrl.get(normalizeRepositoryUrl(entry.url).toLowerCase());
    return [
      {
        owner: data?.owner ?? location.owner,
        name: data?.name ?? location.repo,
        displayName: data?.displayName ?? null,
        functionalities: ids,
        draft: entry.functionalitiesDraft === true,
        analysed: Boolean(data?.latestAnalysis),
      },
    ];
  });
}
