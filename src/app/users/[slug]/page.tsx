import Link from "next/link";
import EndorsementChip from "@/components/EndorsementChip";
import LifecycleChip from "@/components/LifecycleChip";
import OrganisationsSourceNote from "@/components/OrganisationsSourceNote";
import RatingBadge from "@/components/RatingBadge";
import { dataSource } from "@/lib/dataSource";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { staticOrganisationParams } from "@/lib/dataSource/staticDataSource";
import { computeLifecycleStatus } from "@/lib/lifecycle";
import { developmentStatusOf } from "@/lib/maintained";
import { decisionFor, loadMaintainedDecisions } from "@/lib/maintainedDecisions";
import { componentCountLabel } from "@/lib/organisations";
import { componentHref, USERS_PATH } from "@/lib/routes";
import { loadStoredRatings } from "@/lib/storedRatings";
import type { OrganisationDetail } from "@/generated/openapi-client";

interface OrganisationPageProps {
  params: Promise<{ slug: string }>;
}

function BackLink() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <Link href={USERS_PATH} className="inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline">
        ← All users
      </Link>
    </nav>
  );
}

function scannedVersion(analysis: { version?: string | null; scannedRef?: string | null }): string {
  return analysis.version || analysis.scannedRef || "unknown";
}

/** Every organisation page in the static export; the server renders them on request. */
export const generateStaticParams = IS_STATIC_SITE ? staticOrganisationParams : undefined;

export default async function OrganisationPage({ params }: OrganisationPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  let detail: OrganisationDetail | null = null;
  let error: string | null = null;
  try {
    detail = await dataSource().getOrganisation(slug);
  } catch {
    error = "The organisation could not be loaded from the backend.";
  }

  if (!detail) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h2 className="text-2xl font-bold text-cg-blue">User</h2>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error ?? `No followed component declares an organisation with the address ${slug}.`}
        </p>
        <BackLink />
      </div>
    );
  }

  const { organisation } = detail;
  const components = detail.components.filter((component) => component.latestAnalysis);
  const [ratings, decisions] = await Promise.all([
    loadStoredRatings(components.map((component) => component.latestAnalysis ?? {})),
    loadMaintainedDecisions(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const otherSpellings = organisation.spellings.filter((spelling) => spelling !== organisation.name);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <BackLink />
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue break-words">{organisation.name}</h2>
        <p className="text-gray-700">
          Uses {componentCountLabel(organisation.componentCount)}, sorted by name.
        </p>
        {otherSpellings.length > 0 && (
          <p className="text-sm text-gray-600">Also written as: {otherSpellings.join(", ")}.</p>
        )}
        <OrganisationsSourceNote />
      </section>

      <ul aria-label="Components" className="space-y-3">
        {components.map((component, index) => {
          const analysis = component.latestAnalysis!;
          const { rating, endorsement } = ratings[index];
          const lifecycle = computeLifecycleStatus({
            hasAnalysis: true,
            endorsement,
            developmentStatus: developmentStatusOf(analysis.results),
            slas: component.slas,
            today,
            decision: decisionFor(decisions, component.repoUrl),
            drops: {
              open: component.openDropCount ?? 0,
              overdue: component.overdueDropCount ?? 0,
              nextFixBy: component.nextFixBy ?? null,
            },
          });
          return (
            <li
              key={component.repoId}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <Link
                  href={componentHref(component.owner, component.name)}
                  className="inline-flex items-center min-h-[44px] font-semibold text-cg-blue hover:underline break-all"
                >
                  {component.owner}/{component.name}
                </Link>
                <p className="text-xs text-purple-700">Scanned version: {scannedVersion(analysis)}</p>
                {lifecycle.note && <p className="text-xs text-amber-900">{lifecycle.note}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RatingBadge rating={rating} />
                <EndorsementChip endorsement={endorsement} />
                <LifecycleChip status={lifecycle.status} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
