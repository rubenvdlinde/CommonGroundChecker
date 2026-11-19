"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrganisationSummary } from "@/generated/openapi-client";
import { componentCountLabel, filterOrganisations, organisationHref } from "@/lib/organisations";

interface OrganisationsIndexProps {
  organisations: OrganisationSummary[];
  query: string;
}

export default function OrganisationsIndex({ organisations, query }: OrganisationsIndexProps) {
  const [searchValue, setSearchValue] = useState(query);
  const shown = filterOrganisations(organisations, searchValue);

  return (
    <div className="space-y-4">
      <form role="search" method="get" action="/organisations" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="organisation-search" className="block text-xs font-semibold text-gray-700 mb-1">
          Search organisations
        </label>
        <input
          id="organisation-search"
          type="search"
          name="q"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="For example Utrecht"
          className="w-full sm:w-80 min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:border-cg-lightblue focus:outline-none focus:ring-2 focus:ring-cg-lightblue/40"
        />
      </form>

      <p className="text-sm text-gray-500" aria-live="polite">
        {shown.length === organisations.length
          ? `${organisations.length} ${organisations.length === 1 ? "organisation" : "organisations"}`
          : `${shown.length} of ${organisations.length} organisations`}
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-600">No organisation matches this search.</p>
      ) : (
        <ul aria-label="Organisations" className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {shown.map((organisation) => (
            <li key={organisation.slug}>
              <Link
                href={organisationHref(organisation.slug)}
                className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2 hover:bg-gray-50"
              >
                <span className="min-w-0 break-words font-medium text-cg-blue">{organisation.name}</span>
                <span className="shrink-0 text-xs text-gray-500">{componentCountLabel(organisation.componentCount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
