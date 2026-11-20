import type { Metadata } from "next";
import { Suspense } from "react";
import ComparePageView, { type CompareOption } from "@/components/ComparePageView";
import StaticCompare from "@/components/StaticCompare";
import type { RepoSummary } from "@/lib/apiClient";
import { componentKeyText, parseComponentKey, type ComponentKey } from "@/lib/compare";
import { compareSideFrom, type CompareSide } from "@/lib/compareSide";
import { dataSource } from "@/lib/dataSource";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { listedFunctionalitiesOf, loadListedFunctionalities, loadTaxonomy, type ListedFunctionalities } from "@/lib/functionalities/load";
import { listedServicesByComponent, loadRepositoriesConfig } from "@/lib/serviceProviders";

export const metadata: Metadata = {
  title: "Compare | Common Ground Component Checker",
};

interface ComparePageProps {
  searchParams: Promise<{ a?: string | string[]; b?: string | string[] }>;
}

function optionsOf(repositories: RepoSummary[]): CompareOption[] {
  return repositories
    .filter((repository) => repository.latestAnalysis)
    .map((repository) => {
      const key = `${repository.owner}/${repository.name}`;
      return { key, label: repository.displayName ? `${repository.displayName} (${key})` : key };
    })
    .sort((x, y) => x.label.localeCompare(y.label, "en", { sensitivity: "base" }));
}

async function sharedData() {
  const [taxonomy, listed, providers] = await Promise.all([loadTaxonomy(), loadListedFunctionalities(), loadRepositoriesConfig()]);
  return {
    functionalityNames: Object.fromEntries(taxonomy.functionalities.map((item) => [item.id, item.name])),
    listed,
    providers: listedServicesByComponent(providers),
  };
}

async function serverSide(
  key: ComponentKey,
  listed: Map<string, ListedFunctionalities>,
  providers: ReturnType<typeof listedServicesByComponent>
): Promise<CompareSide | null> {
  const history = await dataSource().getRepoHistory(key.owner, key.repo, 1);
  if (!history) return null;
  const { repository } = history;
  const analysis = history.analyses[0] ?? null;
  return compareSideFrom({
    owner: repository.owner,
    repo: repository.name,
    displayName: (repository.metadata as { displayName?: string | null } | null)?.displayName ?? null,
    repoUrl: repository.repoUrl,
    analysis,
    ...listedFunctionalitiesOf(listed, repository.repoUrl),
    providers: providers[componentKeyText(key)] ?? [],
  });
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const shared = await sharedData();

  if (IS_STATIC_SITE) {
    const repositories = await dataSource().listRepositories();
    const listedByKey = Object.fromEntries(
      repositories.map((repository) => [
        `${repository.owner}/${repository.name}`,
        listedFunctionalitiesOf(shared.listed, repository.repoUrl),
      ])
    );
    const props = {
      options: optionsOf(repositories),
      functionalityNames: shared.functionalityNames,
      listed: listedByKey,
      providers: shared.providers,
    };
    return (
      <Suspense
        fallback={
          <ComparePageView
            options={props.options}
            selectedA={null}
            selectedB={null}
            a={null}
            b={null}
            functionalityNames={props.functionalityNames}
          />
        }
      >
        <StaticCompare {...props} />
      </Suspense>
    );
  }

  const query = await searchParams;
  const keyA = parseComponentKey(query.a);
  const keyB = parseComponentKey(query.b);
  let repositories: RepoSummary[] = [];
  let message: string | null = null;
  try {
    repositories = await dataSource().listRepositories({ limit: 50 });
  } catch {
    message = "The components could not be read from the API.";
  }
  let a: CompareSide | null = null;
  let b: CompareSide | null = null;
  if (keyA && keyB && !message) {
    if (componentKeyText(keyA) === componentKeyText(keyB)) {
      message = "Choose two different components.";
    } else {
      [a, b] = await Promise.all([
        serverSide(keyA, shared.listed, shared.providers),
        serverSide(keyB, shared.listed, shared.providers),
      ]);
      const missing = [a ? null : componentKeyText(keyA), b ? null : componentKeyText(keyB)].filter(Boolean);
      if (missing.length > 0) message = `No analysis found for ${missing.join(" and ")}.`;
    }
  }

  return (
    <ComparePageView
      options={optionsOf(repositories)}
      selectedA={keyA ? componentKeyText(keyA) : null}
      selectedB={keyB ? componentKeyText(keyB) : null}
      a={a}
      b={b}
      functionalityNames={shared.functionalityNames}
      message={message}
    />
  );
}
