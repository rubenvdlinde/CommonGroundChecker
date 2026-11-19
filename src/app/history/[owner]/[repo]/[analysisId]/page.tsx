import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { staticAnalysisParams } from "@/lib/dataSource/staticDataSource";
import { HISTORY_MOVED, renderLegacyRedirect } from "@/lib/legacyRedirect";
import { componentHref } from "@/lib/routes";

export const generateStaticParams = IS_STATIC_SITE ? staticAnalysisParams : undefined;

export default async function HistoryRunRedirectPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; analysisId: string }>;
}) {
  const { owner, repo, analysisId } = await params;
  return renderLegacyRedirect(
    componentHref(decodeURIComponent(owner), decodeURIComponent(repo), decodeURIComponent(analysisId)),
    HISTORY_MOVED
  );
}
