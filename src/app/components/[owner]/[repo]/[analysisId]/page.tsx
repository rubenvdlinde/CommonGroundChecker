import RepositoryRunPage from "@/components/RepositoryRunPage";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { staticAnalysisParams } from "@/lib/dataSource/staticDataSource";
import { loadRepositoryRun } from "@/lib/repositoryRun";

interface AnalysisDetailPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    analysisId: string;
  }>;
}

/** The static export has a run page for the latest analysis of each component; the server renders any run on request. */
export const generateStaticParams = IS_STATIC_SITE ? staticAnalysisParams : undefined;

export default async function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
  const { owner: rawOwner, repo: rawRepo, analysisId: rawAnalysisId } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const analysisId = decodeURIComponent(rawAnalysisId);

  return (
    <RepositoryRunPage owner={owner} repo={repo} result={await loadRepositoryRun(owner, repo, analysisId)} />
  );
}
