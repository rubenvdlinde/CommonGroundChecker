import type { Metadata } from "next";
import OrganisationsIndex from "@/components/OrganisationsIndex";
import OrganisationsSourceNote from "@/components/OrganisationsSourceNote";
import { dataSource } from "@/lib/dataSource";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import type { OrganisationSummary } from "@/generated/openapi-client";

export const metadata: Metadata = {
  title: "Users | Common Ground Component Checker",
};

interface OrganisationsPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function OrganisationsPage({ searchParams }: OrganisationsPageProps) {
  // The static export has no request, so its search starts empty.
  const { q } = IS_STATIC_SITE ? { q: undefined } : await searchParams;
  const query = (Array.isArray(q) ? q[0] : q) ?? "";

  let organisations: OrganisationSummary[] = [];
  let error: string | null = null;
  try {
    organisations = (await dataSource().getOrganisations()).organisations ?? [];
  } catch {
    error = IS_STATIC_SITE
      ? "The organisations could not be read from the data files."
      : "The organisations could not be loaded from the backend.";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Users</h2>
        <p className="text-gray-700">
          The organisations that use a component, as the component declares under usedBy in its publiccode.yml. Sorted
          by name.
        </p>
        <OrganisationsSourceNote />
      </section>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      ) : organisations.length === 0 ? (
        <p className="text-sm text-gray-600">No followed component declares any users yet.</p>
      ) : (
        <OrganisationsIndex organisations={organisations} query={query} />
      )}
    </div>
  );
}
