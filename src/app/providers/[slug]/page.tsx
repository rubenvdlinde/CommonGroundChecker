import type { Metadata } from "next";
import Link from "next/link";
import LifecycleChip, { BasissetChip } from "@/components/LifecycleChip";
import ProviderAvatar from "@/components/ProviderAvatar";
import RatingBadge from "@/components/RatingBadge";
import { compareHref } from "@/lib/compare";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { PROVIDERS_PATH } from "@/lib/routes";
import { SERVICE_LABELS, loadProviders, type OwnedComponent } from "@/lib/serviceProviders";

interface ProviderPageProps {
  params: Promise<{ slug: string }>;
}

/** The one page a static export without providers builds, since an export needs at least one page per route. */
export const NO_PROVIDER_SLUG = "none";

/** Every provider in the static export; the server renders them on request. */
async function providerParams(): Promise<Array<{ slug: string }>> {
  const params = (await loadProviders()).map((provider) => ({ slug: provider.slug }));
  return params.length === 0 ? [{ slug: NO_PROVIDER_SLUG }] : params;
}

export const generateStaticParams = IS_STATIC_SITE ? providerParams : undefined;

/** Up to this many rated components, the page lists every pair to compare. */
const MAX_COMPARE_PAIRS_FROM = 5;

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { slug } = await params;
  const provider = (await loadProviders()).find((candidate) => candidate.slug === decodeURIComponent(slug));
  return { title: `${provider?.name ?? "Provider"} | Common Ground Component Checker` };
}

function BackLink() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <Link href={PROVIDERS_PATH} className="inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline">
        ← All providers
      </Link>
    </nav>
  );
}

function keyOf(component: OwnedComponent) {
  return { owner: component.owner, repo: component.repo };
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const provider = (await loadProviders()).find((candidate) => candidate.slug === slug);

  if (!provider) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <BackLink />
        <h2 className="text-2xl font-bold text-cg-blue">Provider</h2>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No component on the list has a provider with the address {slug}.
        </p>
      </div>
    );
  }

  const rated = provider.components.filter((component) => component.analysed);
  const pairs =
    rated.length <= MAX_COMPARE_PAIRS_FROM
      ? rated.flatMap((a, index) => rated.slice(index + 1).map((b) => ({ a, b })))
      : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <BackLink />
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <ProviderAvatar url={provider.avatarUrl} name={provider.name} size={56} />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-cg-blue break-all">{provider.name}</h2>
            <p className="text-sm text-gray-600">
              <a href={provider.url} className="text-cg-lightblue hover:underline" rel="noreferrer" target="_blank">
                {provider.name} on {provider.hostLabel}
              </a>
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          {provider.name} hosts the repositories below, so it provides these components.
        </p>
        {provider.services.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-800">Also offers</h3>
            <ul aria-label={`Services of ${provider.name}`} className="flex flex-wrap gap-2">
              {provider.services.map((service) => (
                <li
                  key={service}
                  className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-cg-lightblue text-cg-blue bg-cg-lightblue/10"
                >
                  {SERVICE_LABELS[service]}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500">Taken from the component list. We do not check what it offers.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="provided-components" className="space-y-3">
        <h3 id="provided-components" className="text-lg font-semibold text-gray-800">
          Components
        </h3>
        <ul aria-label="Components" className="space-y-3">
          {provider.components.map((component) => (
            <li key={component.repoUrl} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {component.analysed ? (
                  <Link href={component.href} className="font-medium text-cg-blue hover:underline break-all">
                    {component.name}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-800 break-all">{component.name}</span>
                )}
                {component.analysed && <RatingBadge rating={component.rating} />}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                {component.status && <LifecycleChip status={component.status} />}
                {component.basisset !== null && <BasissetChip inBasisset={component.basisset} />}
                {!component.analysed && <span className="text-xs text-gray-500">Not rated yet</span>}
              </p>
              {component.name !== `${component.owner}/${component.repo}` && (
                <p className="text-xs text-gray-600 break-all">
                  {component.owner}/{component.repo}
                </p>
              )}
              {component.services.length > 0 && (
                <p className="text-xs text-gray-600">
                  Also offers: {component.services.map((service) => SERVICE_LABELS[service].toLowerCase()).join(", ")}
                </p>
              )}
              {component.analysed && pairs.length === 0 && rated.length > 1 && (
                <Link href={compareHref(keyOf(component), null)} className="inline-flex min-h-[44px] items-center text-sm text-cg-lightblue hover:underline">
                  Compare {component.name} with another component
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {pairs.length > 0 && (
        <section aria-labelledby="compare-pairs" className="space-y-2">
          <h3 id="compare-pairs" className="text-lg font-semibold text-gray-800">
            Compare
          </h3>
          <ul className="space-y-1 text-sm">
            {pairs.map(({ a, b }) => (
              <li key={`${a.repoUrl} ${b.repoUrl}`}>
                <Link href={compareHref(keyOf(a), keyOf(b))} className="inline-flex min-h-[44px] items-center text-cg-lightblue hover:underline">
                  {a.name} and {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
