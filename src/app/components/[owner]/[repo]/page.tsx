import RepositoryRunPage from "@/components/RepositoryRunPage";
import type { UsageStatus } from "@/lib/apiClient";
import { loadBasisset, matchBasisset } from "@/lib/basisset";
import { dataSource } from "@/lib/dataSource";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { staticRepositoryParams } from "@/lib/dataSource/staticDataSource";
import { MIN_USERS_FOR_SUITABLE } from "@/lib/ratings";
import type { ComponentLandscape } from "@/components/FunctionalitiesSection";
import { publiccodeFeatures } from "@/lib/compareSide";
import { standardsOfResults } from "@/lib/componentStandards";
import { listRepositoriesOrNone } from "@/lib/functionalities/landscapeData";
import { listedFunctionalitiesOf, loadListedFunctionalities, loadTaxonomy } from "@/lib/functionalities/load";
import type { RepositoryRun } from "@/lib/repositoryRun";

async function loadLandscape(run: RepositoryRun): Promise<ComponentLandscape> {
  const componentKey = `${run.repository.owner}/${run.repository.name}`;
  const [taxonomy, listed, repositories] = await Promise.all([
    loadTaxonomy(),
    loadListedFunctionalities(),
    listRepositoriesOrNone(),
  ]);
  const names = new Map(taxonomy.functionalities.map((item) => [item.id, item.name]));
  const own = listedFunctionalitiesOf(listed, run.repository.repoUrl);
  const results = run.selected?.results ?? [];
  return {
    componentKey,
    functionalities: own.functionalities.filter((id) => names.has(id)).map((id) => ({ id, name: names.get(id) as string })),
    draft: own.functionalitiesDraft,
    features: publiccodeFeatures(results),
    standards: run.selected?.detailAvailable === false ? null : standardsOfResults(results),
    compareOptions: repositories
      .filter((repository) => repository.latestAnalysis && `${repository.owner}/${repository.name}` !== componentKey)
      .map((repository) => {
        const key = `${repository.owner}/${repository.name}`;
        return { key, label: repository.displayName ? `${repository.displayName} (${key})` : key };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" })),
  };
}
import { organisationSlugsByKey } from "@/lib/organisations";
import { lifecycleOfRun, loadRepositoryRun } from "@/lib/repositoryRun";

interface HistoryPageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/** Every component page in the static export; the server renders them on request. */
export const generateStaticParams = IS_STATIC_SITE ? staticRepositoryParams : undefined;

async function loadUsage(repoId: string): Promise<UsageStatus | null> {
  try {
    return (await dataSource().getRepositoryUsage(repoId)) ?? null;
  } catch {
    return null;
  }
}

async function loadOrganisationSlugs(): Promise<Record<string, string>> {
  try {
    return Object.fromEntries(organisationSlugsByKey((await dataSource().getOrganisations())?.organisations ?? []));
  } catch {
    return {};
  }
}

export default async function RepoHistoryPage({ params }: HistoryPageProps) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const result = await loadRepositoryRun(owner, repo);
  if (result.kind !== "found") return <RepositoryRunPage owner={owner} repo={repo} result={result} />;

  const [usage, organisationSlugs, basisset, landscape] = await Promise.all([
    loadUsage(result.run.repository.id),
    loadOrganisationSlugs(),
    loadBasisset(),
    loadLandscape(result.run),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const { run } = result;
  const scannedVersion = run.runs[0]?.version ?? run.repoMeta.version ?? null;

  return (
    <RepositoryRunPage
      owner={owner}
      repo={repo}
      result={result}
      maintained={{ usage, minUsers: MIN_USERS_FOR_SUITABLE, today, organisationSlugs }}
      lifecycle={{
        result: lifecycleOfRun(run, { usage, today }),
        basisset: matchBasisset(basisset, run.repository.repoUrl, scannedVersion),
        scannedVersion,
        retiredAt: run.repository.retiredAt,
        adminControls: !IS_STATIC_SITE,
      }}
      landscape={landscape}
    />
  );
}
