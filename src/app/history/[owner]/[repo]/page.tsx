import RepositoryRunPage from "@/components/RepositoryRunPage";
import { getOrganisations, getRepositoryUsage, type UsageStatus } from "@/lib/apiClient";
import { minUsers } from "@/lib/maintained";
import { organisationSlugsByKey } from "@/lib/organisations";
import { loadRepositoryRun } from "@/lib/repositoryRun";

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

  const [usage, organisationSlugs] = await Promise.all([
    loadUsage(result.run.repository.id),
    loadOrganisationSlugs(),
  ]);

  return (
    <RepositoryRunPage
      owner={owner}
      repo={repo}
      result={result}
      maintained={{ usage, minUsers: minUsers(), today: new Date().toISOString().slice(0, 10), organisationSlugs }}
    />
  );
}
