/**
 * One side of the compare page: a component with its latest analysis, its
 * functionalities and standards, its provider and the services listed for it. Both modes
 * build it from the same fields, so the page renders them the same way.
 */
import type { ComparedAnalysis, ComponentKey } from "./compare";
import { standardsOfResults, type ComponentStandard } from "./componentStandards";
import { storedCategoryRatings } from "./ratings";
import { ownerOfRepository, type RepositoryOwner } from "./repositoryOwner";
import { componentHref } from "./routes";
import type { ProviderService } from "./staticSite/config";
import type { PublicCodeData } from "./types";

/** Services an organisation listed for the component in the component list. */
export interface CompareProvider {
  name: string;
  url: string | null;
  services: ProviderService[];
}

export interface CompareSide {
  key: ComponentKey;
  name: string;
  repoUrl: string;
  href: string;
  checkedAt: string | null;
  version: string | null;
  /** Null when the component has no analysis with results */
  analysis: ComparedAnalysis | null;
  functionalities: string[];
  functionalitiesDraft: boolean;
  /** description.*.features of publiccode.yml: the English list, else the first one given */
  features: string[];
  /** Null when the analysis did not measure standards */
  standards: ComponentStandard[] | null;
  /** The owner of the repository; null for a URL that names no repository */
  provider: RepositoryOwner | null;
  providers: CompareProvider[];
}

export interface CompareSideInput {
  owner: string;
  repo: string;
  displayName?: string | null;
  repoUrl: string;
  analysis: {
    checkedAt?: string | null;
    version?: string | null;
    rating?: number | null;
    categoryRatings?: unknown;
    aspectRatings?: unknown;
    results?: unknown;
  } | null;
  functionalities?: string[];
  functionalitiesDraft?: boolean;
  providers?: CompareProvider[];
}

type Result = ComparedAnalysis["results"][number] & { evidence?: string[]; publiccode?: PublicCodeData };

function resultsOf(value: unknown): Result[] {
  return Array.isArray(value)
    ? value.filter((item): item is Result => !!item && typeof item === "object" && typeof (item as Result).id === "string")
    : [];
}

function record<T>(value: unknown): Record<string, T> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, T>) : null;
}

/** The features of publiccode.yml in English, else in the first language that lists any. */
export function publiccodeFeatures(results: Array<{ id: string; publiccode?: PublicCodeData }>): string[] {
  const descriptions = results.find((result) => result.id === "publiccode")?.publiccode?.descriptions ?? [];
  const withFeatures = descriptions.filter((description) => (description.features ?? []).length > 0);
  const chosen = withFeatures.find((description) => description.language === "en") ?? withFeatures[0];
  return chosen ? [...chosen.features] : [];
}

export function compareSideFrom(input: CompareSideInput): CompareSide {
  const results = resultsOf(input.analysis?.results);
  const analysis: ComparedAnalysis | null =
    input.analysis && results.length > 0
      ? {
          rating: typeof input.analysis.rating === "number" ? input.analysis.rating : null,
          categoryRatings: storedCategoryRatings(input.analysis.categoryRatings),
          aspectRatings: record<{ rating: number | null }>(input.analysis.aspectRatings),
          results,
        }
      : null;
  return {
    key: { owner: input.owner, repo: input.repo },
    name: input.displayName?.trim() || `${input.owner}/${input.repo}`,
    repoUrl: input.repoUrl,
    href: componentHref(input.owner, input.repo),
    checkedAt: input.analysis?.checkedAt ?? null,
    version: input.analysis?.version ?? null,
    analysis,
    functionalities: input.functionalities ?? [],
    functionalitiesDraft: input.functionalitiesDraft === true,
    features: publiccodeFeatures(results),
    standards: analysis ? standardsOfResults(results) : null,
    provider: ownerOfRepository(input.repoUrl),
    providers: input.providers ?? [],
  };
}

/** Shared standards and the standards only one side supports, by id. */
export function standardOverlap(a: ComponentStandard[] | null, b: ComponentStandard[] | null) {
  if (!a || !b) return null;
  const idsB = new Set(b.map((standard) => standard.id));
  const idsA = new Set(a.map((standard) => standard.id));
  return {
    shared: a.filter((standard) => idsB.has(standard.id)),
    onlyA: a.filter((standard) => !idsB.has(standard.id)),
    onlyB: b.filter((standard) => !idsA.has(standard.id)),
  };
}
