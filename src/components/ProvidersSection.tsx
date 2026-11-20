import Link from "next/link";
import { PROVIDERS_PATH } from "@/lib/routes";
import { SERVICE_LABELS, contactHref } from "@/lib/serviceProviders";
import type { ServiceProvider } from "@/lib/staticSite/config";

/** Services organisations listed for a component in the component list, next to its provider. */
export default function ProvidersSection({ providers, listUrl }: { providers: ServiceProvider[]; listUrl: string }) {
  if (providers.length === 0) return null;
  return (
    <section aria-labelledby="providers" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <h3 id="providers" className="text-lg font-semibold text-gray-800">
        Also offers
      </h3>
      <ul aria-label="Also offers" className="space-y-3">
        {providers.map((provider) => {
          const href = provider.contact ? contactHref(provider.contact) : null;
          return (
            <li key={provider.name} className="space-y-1">
              <p className="font-medium text-gray-800 break-words">
                {provider.url ? (
                  <a href={provider.url} className="text-cg-lightblue hover:underline" rel="noreferrer" target="_blank">
                    {provider.name}
                  </a>
                ) : (
                  provider.name
                )}
              </p>
              <ul aria-label={`Services of ${provider.name}`} className="flex flex-wrap gap-2">
                {provider.services.map((service) => (
                  <li
                    key={service}
                    className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-cg-lightblue text-cg-blue bg-cg-lightblue/10"
                  >
                    {SERVICE_LABELS[service] ?? service}
                  </li>
                ))}
              </ul>
              {(provider.contact || provider.since) && (
                <p className="text-xs text-gray-500 break-words">
                  {provider.contact &&
                    (href ? (
                      <a href={href} className="text-cg-lightblue hover:underline">
                        {provider.contact}
                      </a>
                    ) : (
                      provider.contact
                    ))}
                  {provider.contact && provider.since ? ". " : ""}
                  {provider.since ? `Listed since ${provider.since}.` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500">
        Taken from the{" "}
        <a href={listUrl} className="text-cg-lightblue hover:underline">
          component list
        </a>
        . We do not check what they offer.{" "}
        <Link href={PROVIDERS_PATH} className="text-cg-lightblue hover:underline">
          All providers
        </Link>
      </p>
    </section>
  );
}
