import RepositoryRunPage from "@/components/RepositoryRunPage";
import { loadRepositoryRun } from "@/lib/repositoryRun";

interface AnalysisDetailPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    analysisId: string;
  }>;
}

export default async function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
  const { owner: rawOwner, repo: rawRepo, analysisId: rawAnalysisId } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const analysisId = decodeURIComponent(rawAnalysisId);

  return (
    <RepositoryRunPage owner={owner} repo={repo} result={await loadRepositoryRun(owner, repo, analysisId)} />
  );
}
