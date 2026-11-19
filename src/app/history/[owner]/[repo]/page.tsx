import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { staticRepositoryParams } from "@/lib/dataSource/staticDataSource";
import { HISTORY_MOVED, renderLegacyRedirect } from "@/lib/legacyRedirect";
import { componentHref } from "@/lib/routes";

export const generateStaticParams = IS_STATIC_SITE ? staticRepositoryParams : undefined;

export default async function HistoryRepositoryRedirectPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return renderLegacyRedirect(componentHref(decodeURIComponent(owner), decodeURIComponent(repo)), HISTORY_MOVED);
}
