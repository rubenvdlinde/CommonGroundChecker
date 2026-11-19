import RepositoryRunPage from "@/components/RepositoryRunPage";
import { loadRepositoryRun } from "@/lib/repositoryRun";

interface HistoryPageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export default async function RepoHistoryPage({ params }: HistoryPageProps) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  return <RepositoryRunPage owner={owner} repo={repo} result={await loadRepositoryRun(owner, repo)} />;
}
