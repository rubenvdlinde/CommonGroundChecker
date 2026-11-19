"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { RequirementLevel } from "@/lib/types";
import type { CriterionSource } from "@/lib/criterionDocs";

export interface CriteriaIndexRow {
  id: string;
  title: string;
  href: string;
  what: string;
  category: string;
  level: RequirementLevel;
  source: CriterionSource;
  measured: boolean;
}

interface CriteriaIndexProps {
  rows: CriteriaIndexRow[];
  categories: string[];
  levels: { value: RequirementLevel; label: string }[];
  sources: { value: CriterionSource; label: string }[];
}

type Filters = { category: string; level: string; source: string };

const FILTER_KEYS: (keyof Filters)[] = ["category", "level", "source"];

function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])) as Filters;
}

const FILTERS_CHANGED = "criteria-filters-changed";

function writeFilters(filters: Filters) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  window.dispatchEvent(new Event(FILTERS_CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener(FILTERS_CHANGED, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(FILTERS_CHANGED, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const SELECT = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";

export default function CriteriaIndex({ rows, categories, levels, sources }: CriteriaIndexProps) {
  // The filters live in the query string, so a filtered list can be shared; the static page renders unfiltered.
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const filters = useMemo(() => readFilters(search), [search]);

  const update = (key: keyof Filters, value: string) => writeFilters({ ...filters, [key]: value });

  const shown = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!filters.category || row.category === filters.category) &&
          (!filters.level || row.level === filters.level) &&
          (!filters.source || row.source === filters.source)
      ),
    [rows, filters]
  );

  const levelLabel = Object.fromEntries(levels.map((level) => [level.value, level.label]));
  const sourceLabel = Object.fromEntries(sources.map((source) => [source.value, source.label]));

  return (
    <div className="space-y-4">
      <form className="grid gap-3 sm:grid-cols-3" aria-label="Filter the criteria" onSubmit={(event) => event.preventDefault()}>
        <label className="text-sm font-medium text-gray-700">
          Category
          <select className={SELECT} value={filters.category} onChange={(event) => update("category", event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Level
          <select className={SELECT} value={filters.level} onChange={(event) => update("level", event.target.value)}>
            <option value="">All levels</option>
            {levels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Source
          <select className={SELECT} value={filters.source} onChange={(event) => update("source", event.target.value)}>
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <p className="text-sm text-gray-600" aria-live="polite">
        {shown.length} of {rows.length} criteria
      </p>

      <ul className="space-y-3">
        {shown.map((row) => (
          <li key={row.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-2">
            <Link href={row.href} className="text-lg font-semibold text-cg-lightblue hover:underline">
              {row.title}
            </Link>
            <p className="text-gray-700">{row.what}</p>
            <p className="flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
              <span className="rounded-full border border-gray-300 px-2 py-0.5">{row.category}</span>
              <span className="rounded-full border border-gray-300 px-2 py-0.5">{levelLabel[row.level]}</span>
              <span className="rounded-full border border-gray-300 px-2 py-0.5">{sourceLabel[row.source]}</span>
              {!row.measured && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">
                  In an open change
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
