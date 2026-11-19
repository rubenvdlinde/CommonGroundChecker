import type { Metadata } from "next";
import Link from "next/link";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { PROVIDERS_PATH } from "@/lib/routes";
import { SERVICE_LABELS, contactHref, loadProviders } from "@/lib/serviceProviders";
import type { ProviderService } from "@/lib/staticSite/config";

interface ProviderPageProps {
  params: Promise<{ slug: string }>;
}

/** The one page a static export without providers builds, since an export needs at least one page per route. */
export const NO_PROVIDER_SLUG = "none";

/** Built from the component list in both modes; a new provider arrives with a new build. */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const params = (await loadProviders()).map((provider) => ({ slug: provider.slug }));
  return params.length === 0 && IS_STATIC_SITE ? [{ slug: NO_PROVIDER_SLUG }] : params;
}

export const dynamicParams = false;

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { slug } = await params;
  const provider = (await loadProviders()).find((candidate) => candidate.slug === decodeURIComponent(slug));
  return { title: `${provider?.name ?? "Provider"} | Common Ground Component Checker` };
}

function ServiceChips({ services, label }: { services: ProviderService[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {services.map((service) => (
        <li
          key={service}
          className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-cg-lightblue text-cg-blue bg-cg-lightblue/10"
        >
          {SERVICE_LABELS[service]}
        </li>
      ))}
    </ul>
  );
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
          No component in the component list names a provider with the address {slug}.
        </p>
      </div>
    );
  }

  const contact = provider.contact ? contactHref(provider.contact) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <BackLink />
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue break-words">{provider.name}</h2>
        <ServiceChips services={provider.services} label={`Services of ${provider.name}`} />
        <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-gray-700">
          {provider.url && (
            <>
              <dt className="font-semibold">Website</dt>
              <dd className="break-words">
                <a href={provider.url} className="text-cg-lightblue hover:underline" rel="noreferrer" target="_blank">
                  {provider.url}
                </a>
              </dd>
            </>
          )}
          {provider.contact && (
            <>
              <dt className="font-semibold">Contact</dt>
              <dd className="break-words">
                {contact ? (
                  <a href={contact} className="text-cg-lightblue hover:underline">
                    {provider.contact}
                  </a>
                ) : (
                  provider.contact
                )}
              </dd>
            </>
          )}
          {provider.since && (
            <>
              <dt className="font-semibold">Listed since</dt>
              <dd>{provider.since}</dd>
            </>
          )}
        </dl>
        <p className="text-sm text-gray-600">
          The provider added itself to the component list. The checker does not verify what it offers.
        </p>
      </section>

      <section aria-labelledby="provided-components" className="space-y-3">
        <h3 id="provided-components" className="text-lg font-semibold text-gray-800">
          Components it serves
        </h3>
        <ul aria-label="Components" className="space-y-3">
          {provider.components.map((component) => (
            <li
              key={component.url}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2"
            >
              <Link href={component.href} className="font-medium text-cg-blue hover:underline break-words">
                {component.owner}/{component.repo}
              </Link>
              <ServiceChips services={component.services} label={`Services for ${component.owner}/${component.repo}`} />
              {component.since && <p className="text-xs text-gray-500">Since {component.since}.</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
