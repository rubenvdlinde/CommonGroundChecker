import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { staticOrganisationParams } from "@/lib/dataSource/staticDataSource";
import { ORGANISATIONS_MOVED, renderLegacyRedirect } from "@/lib/legacyRedirect";
import { userHref } from "@/lib/routes";

export const generateStaticParams = IS_STATIC_SITE ? staticOrganisationParams : undefined;

export default async function OrganisationRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderLegacyRedirect(userHref(decodeURIComponent(slug)), ORGANISATIONS_MOVED);
}
