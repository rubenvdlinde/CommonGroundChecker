import OrganisationsIndex from "@/components/OrganisationsIndex";
import OrganisationsSourceNote from "@/components/OrganisationsSourceNote";
import { getOrganisations } from "@/lib/apiClient";
import type { OrganisationSummary } from "@/generated/openapi-client";

interface OrganisationsPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function OrganisationsPage({ searchParams }: OrganisationsPageProps) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q) ?? "";

  let organisations: OrganisationSummary[] = [];
  let error: string | null = null;
  try {
    organisations = (await getOrganisations()).organisations ?? [];
  } catch {
    error = "The organisations could not be loaded from the backend.";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Organisations</h2>
        <p className="text-gray-700">The organisations that use followed components, sorted by name.</p>
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
