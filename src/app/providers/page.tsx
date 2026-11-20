import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import LifecycleChip from "@/components/LifecycleChip";
import ProviderAvatar from "@/components/ProviderAvatar";
import ProvidersEmptyState from "@/components/ProvidersEmptyState";
import RatingBadge from "@/components/RatingBadge";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { providerHref } from "@/lib/routes";
import { loadProviders } from "@/lib/serviceProviders";

export const metadata: Metadata = {
  title: "Providers | Common Ground Component Checker",
};

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "component" : "components"}`;
}

export default async function ProvidersPage() {
  if (!IS_STATIC_SITE) await connection();
  const providers = await loadProviders();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Providers</h2>
        <p className="text-gray-700">
          A provider is the organisation or person that hosts a component&apos;s repository on GitHub or GitLab. We
          take it from the repository address, so every component on the list has one. This is not a ranking.
        </p>
      </section>

      {providers.length === 0 ? (
        <ProvidersEmptyState />
      ) : (
        <ul aria-label="Providers" className="space-y-3">
          {providers.map((provider) => (
            <li key={provider.slug} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <ProviderAvatar url={provider.avatarUrl} name={provider.name} size={40} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={providerHref(provider.slug)}
                    className="inline-flex min-h-[44px] items-center break-all font-semibold text-cg-blue hover:underline"
                  >
                    {provider.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {provider.hostLabel}, {countLabel(provider.components.length)}
                  </p>
                </div>
                {provider.bestRating !== null && <RatingBadge rating={provider.bestRating} label="Best rating" />}
              </div>
              <ul aria-label={`Components of ${provider.name}`} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {provider.components.map((component) => (
                  <li key={component.repoUrl} className="flex min-w-0 flex-wrap items-center gap-2">
                    {component.analysed ? (
                      <Link href={component.href} className="break-all text-cg-lightblue hover:underline">
                        {component.name}
                      </Link>
                    ) : (
                      <span className="break-all text-gray-700">{component.name}</span>
                    )}
                    {component.status && <LifecycleChip status={component.status} />}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
