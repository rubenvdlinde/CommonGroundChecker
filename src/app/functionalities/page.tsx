import type { Metadata } from "next";
import Link from "next/link";
import LandscapeComponentLinks from "@/components/LandscapeComponentLinks";
import { STATIC_SITE_LINKS } from "@/lib/dataSource/mode";
import { loadFunctionalityLandscape } from "@/lib/functionalities/landscapeData";
import { landscapeCounts, type LandscapeEntry } from "@/lib/functionalities/overlap";
import { functionalityHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Functionalities | Common Ground Component Checker",
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function EntryList({ entries, analysed }: { entries: LandscapeEntry[]; analysed: Set<string> }) {
  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((entry) => (
        <li key={entry.functionality.id} className="space-y-2 py-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <Link href={functionalityHref(entry.functionality.id)} className="break-words font-medium text-cg-blue hover:underline">
              {entry.functionality.name}
            </Link>
            <span className="text-xs text-gray-500">
              {entry.referenceComponents.map((component) => component.name).join(", ")}
            </span>
          </p>
          <LandscapeComponentLinks components={entry.components} analysed={analysed} />
        </li>
      ))}
    </ul>
  );
}

export default async function FunctionalitiesPage() {
  const { taxonomy, entries, analysed, mapped, drafts } = await loadFunctionalityLandscape();
  const counts = landscapeCounts(entries);
  const overlap = entries.filter((entry) => entry.kind === "overlap");
  const single = entries.filter((entry) => entry.kind === "single");
  const gapsByReference = taxonomy.referenceComponents
    .map((reference) => ({
      reference,
      gaps: entries.filter((entry) => entry.kind === "gap" && entry.referenceComponents.some((item) => item.id === reference.id)),
    }))
    .filter((group) => group.gaps.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue">Functionalities</h2>
        <p className="text-gray-700">
          What each component does, mapped on one shared list. Where more than one component provides the same
          functionality, they may overlap and a choice can be made. Where none does, there is a gap.
        </p>
        <p className="text-sm text-gray-700">
          The list is GEMMA: the {plural(taxonomy.functionalities.length, "application service", "application services")}{" "}
          that the {plural(taxonomy.referenceComponents.length, "reference component", "reference components")} of VNG
          Realisatie realise{taxonomy.source.release ? `, release of ${taxonomy.source.release}` : ""}. Municipalities
          already use it to describe their application landscape. It is published under the {taxonomy.source.licence}.{" "}
          {taxonomy.source.url && (
            <a href={taxonomy.source.url} className="text-cg-lightblue hover:underline">
              The GEMMA model on GitHub
            </a>
          )}
        </p>
        <p className="text-sm text-gray-700">
          A component lists its functionalities in the{" "}
          <a href={STATIC_SITE_LINKS.componentList} className="text-cg-lightblue hover:underline">
            component list
          </a>{" "}
          by pull request. {plural(mapped, "component lists", "components list")} functionalities now
          {drafts > 0
            ? `; ${drafts} of those ${drafts === 1 ? "lists is" : "lists are"} a draft that the component owners still have to confirm`
            : ""}
          .
        </p>
      </section>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        <a href="#overlap" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:border-amber-400">
          <p className="text-2xl font-bold text-amber-900">{counts.overlap}</p>
          <p className="text-sm text-amber-900">provided by more than one component: candidate overlap</p>
        </a>
        <a href="#single" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-cg-lightblue">
          <p className="text-2xl font-bold text-cg-blue">{counts.single}</p>
          <p className="text-sm text-gray-700">provided by one component</p>
        </a>
        <a href="#gaps" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-cg-lightblue">
          <p className="text-2xl font-bold text-gray-700">{counts.gap}</p>
          <p className="text-sm text-gray-700">provided by no listed component: a gap</p>
        </a>
      </section>

      <section id="overlap" aria-labelledby="overlap-heading" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 id="overlap-heading" className="text-lg font-semibold text-cg-blue">
          Candidate overlap
        </h3>
        <p className="text-sm text-gray-600">
          More than one component provides these. That is a reason to look closer, not a verdict: compare the
          components to see what each does on its own.
        </p>
        {overlap.length === 0 ? (
          <p className="pt-2 text-sm text-gray-500">No functionality is provided by more than one component yet.</p>
        ) : (
          <EntryList entries={overlap} analysed={analysed} />
        )}
      </section>

      <section id="single" aria-labelledby="single-heading" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 id="single-heading" className="text-lg font-semibold text-cg-blue">
          Provided by one component
        </h3>
        {single.length === 0 ? (
          <p className="pt-2 text-sm text-gray-500">None yet.</p>
        ) : (
          <EntryList entries={single} analysed={analysed} />
        )}
      </section>

      <section id="gaps" aria-labelledby="gaps-heading" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 space-y-2">
        <h3 id="gaps-heading" className="text-lg font-semibold text-cg-blue">
          Gaps
        </h3>
        <p className="text-sm text-gray-600">
          No component on the list provides these yet. Most gaps say only that no component has been mapped, so read
          them together with how many components list their functionalities.
        </p>
        <ul className="divide-y divide-gray-100">
          {gapsByReference.map(({ reference, gaps }) => (
            <li key={reference.id}>
              <details>
                <summary className="flex min-h-[44px] cursor-pointer items-center py-2 text-sm text-gray-800">
                  {reference.name} ({gaps.length})
                </summary>
                <ul className="space-y-1 pb-3 pl-4 text-sm">
                  {gaps.map((entry) => (
                    <li key={entry.functionality.id}>
                      <Link
                        href={functionalityHref(entry.functionality.id)}
                        className="inline-flex min-h-[44px] items-center break-words text-cg-lightblue hover:underline sm:min-h-0"
                      >
                        {entry.functionality.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
