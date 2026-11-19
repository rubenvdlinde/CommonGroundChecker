import type { Metadata } from "next";
import Link from "next/link";
import ProvidersEmptyState from "@/components/ProvidersEmptyState";
import { providerHref } from "@/lib/routes";
import { SERVICE_LABELS, loadProviders } from "@/lib/serviceProviders";

export const metadata: Metadata = {
  title: "Providers | Common Ground Component Checker",
};

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "component" : "components"}`;
}

export default async function ProvidersPage() {
  const providers = await loadProviders();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Providers</h2>
        <p className="text-gray-700">
          Organisations that offer services for a component: maintenance, support, hosting, implementation or
          training. Each provider adds itself to the component list by pull request. The checker does not verify what
          they offer, and this is not a ranking.
        </p>
      </section>

      {providers.length === 0 ? (
        <ProvidersEmptyState />
      ) : (
        <ul aria-label="Providers" className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {providers.map((provider) => (
            <li key={provider.slug}>
              <Link
                href={providerHref(provider.slug)}
                className="flex min-h-[44px] flex-col gap-1 px-4 py-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 break-words font-medium text-cg-blue">{provider.name}</span>
                <span className="text-xs text-gray-500">
                  {countLabel(provider.components.length)}:{" "}
                  {provider.services.map((service) => SERVICE_LABELS[service].toLowerCase()).join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
