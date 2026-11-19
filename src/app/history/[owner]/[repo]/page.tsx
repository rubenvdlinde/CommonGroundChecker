import RepositoryRunPage from "@/components/RepositoryRunPage";
import { getOrganisations, getRepositoryUsage, type UsageStatus } from "@/lib/apiClient";
import { loadBasisset, matchBasisset } from "@/lib/basisset";
import { minUsers } from "@/lib/maintained";
import { organisationSlugsByKey } from "@/lib/organisations";
import { lifecycleOfRun, loadRepositoryRun } from "@/lib/repositoryRun";

interface HistoryPageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

async function loadUsage(repoId: string): Promise<UsageStatus | null> {
  try {
    return (await getRepositoryUsage(repoId)) ?? null;
  } catch {
    return null;
  }
}

async function loadOrganisationSlugs(): Promise<Record<string, string>> {
  try {
    return Object.fromEntries(organisationSlugsByKey((await getOrganisations())?.organisations ?? []));
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

  const [usage, organisationSlugs, basisset] = await Promise.all([
    loadUsage(result.run.repository.id),
    loadOrganisationSlugs(),
    loadBasisset(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const minimumUsers = minUsers();
  const { run } = result;
  const scannedVersion = run.runs[0]?.version ?? run.repoMeta.version ?? null;

  return (
    <RepositoryRunPage
      owner={owner}
      repo={repo}
      result={result}
      maintained={{ usage, minUsers: minimumUsers, today, organisationSlugs }}
      lifecycle={{
        result: lifecycleOfRun(run, { usage, minUsers: minimumUsers, today }),
        basisset: matchBasisset(basisset, run.repository.repoUrl, scannedVersion),
        scannedVersion,
        retiredAt: run.repository.retiredAt,
        adminControls: true,
      }}
    />
  );
}
