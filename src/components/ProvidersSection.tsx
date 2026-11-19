import type { ServiceProvider } from "@/lib/staticSite/config";

const SERVICE_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  support: "Support",
  hosting: "Hosting",
  implementation: "Implementation",
  training: "Training",
};

function contactHref(contact: string): string | null {
  if (/^https?:\/\//.test(contact)) return contact;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`;
  return null;
}

/** Organisations that offer services on top of a component, as listed in the component list. */
export default function ProvidersSection({ providers, listUrl }: { providers: ServiceProvider[]; listUrl: string }) {
  return (
    <section aria-labelledby="providers" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <h3 id="providers" className="text-lg font-semibold text-gray-800">
        Service providers
      </h3>
      {providers.length === 0 ? (
        <p className="text-sm text-gray-700">No service providers listed.</p>
      ) : (
        <ul aria-label="Service providers" className="space-y-3">
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
      )}
      <p className="text-xs text-gray-500">
        Providers add themselves to the{" "}
        <a href={listUrl} className="text-cg-lightblue hover:underline">
          component list
        </a>{" "}
        with a pull request. The checker does not verify what they offer.
      </p>
    </section>
  );
}
