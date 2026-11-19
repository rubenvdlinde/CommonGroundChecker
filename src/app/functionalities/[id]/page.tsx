import type { Metadata } from "next";
import Link from "next/link";
import LandscapeComponentLinks from "@/components/LandscapeComponentLinks";
import { compareHref } from "@/lib/compare";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { loadFunctionalityLandscape } from "@/lib/functionalities/landscapeData";
import { loadTaxonomy } from "@/lib/functionalities/load";
import { gemmaUrl } from "@/lib/functionalities/taxonomy";
import { buildHistoryHref } from "@/lib/historySearch";
import { FUNCTIONALITIES_PATH } from "@/lib/routes";

interface FunctionalityPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Functionality | Common Ground Component Checker",
};

async function functionalityParams(): Promise<Array<{ id: string }>> {
  return (await loadTaxonomy()).functionalities.map((functionality) => ({ id: functionality.id }));
}

/** A page for every functionality in the static export; the server renders them on request. */
export const generateStaticParams = IS_STATIC_SITE ? functionalityParams : undefined;

export default async function FunctionalityPage({ params }: FunctionalityPageProps) {
  const id = decodeURIComponent((await params).id);
  const { entries, analysed } = await loadFunctionalityLandscape();
  const entry = entries.find((item) => item.functionality.id === id);

  if (!entry) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <h2 className="text-2xl font-bold text-cg-blue">Functionality not found</h2>
        <p className="text-gray-700">There is no functionality {id} in the list.</p>
        <Link href={FUNCTIONALITIES_PATH} className="text-cg-lightblue hover:underline">
          See every functionality
        </Link>
      </div>
    );
  }

  const { functionality, referenceComponents, components, kind } = entry;
  const pairs = components.flatMap((a, index) =>
    components
      .slice(index + 1)
      .filter((b) => analysed.has(`${a.owner}/${a.name}`) && analysed.has(`${b.owner}/${b.name}`))
      .map((b) => ({ a, b }))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <Link href={FUNCTIONALITIES_PATH} className="text-cg-lightblue hover:underline">
          Functionalities
        </Link>{" "}
        / {functionality.name}
      </nav>
      <section className="space-y-2">
        <h2 className="break-words text-2xl font-bold text-cg-blue">{functionality.name}</h2>
        {functionality.description && <p className="text-gray-700">{functionality.description}</p>}
        <p className="text-sm text-gray-600">
          GEMMA application service, realised by{" "}
          {referenceComponents.map((component, index) => (
            <span key={component.id}>
              {index > 0 && ", "}
              <a href={gemmaUrl(component.gemmaId)} className="text-cg-lightblue hover:underline">
                {component.name}
              </a>
            </span>
          ))}
          .{" "}
          {functionality.gemmaId && (
            <a href={gemmaUrl(functionality.gemmaId)} className="text-cg-lightblue hover:underline">
              This service on GEMMA online
            </a>
          )}
        </p>
      </section>

      <section aria-labelledby="providers-heading" className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 id="providers-heading" className="text-lg font-semibold text-cg-blue">
          Components that provide it
        </h3>
        <p className="text-sm text-gray-700">
          {kind === "overlap"
            ? `${components.length} components provide it. That is a candidate overlap: compare them to see what each does on its own.`
            : kind === "single"
              ? "One component provides it."
              : "No component on the list provides it yet. That is a gap, or a component that has not listed its functionalities."}
        </p>
        {components.length > 0 && <LandscapeComponentLinks components={components} analysed={analysed} />}
        {components.some((component) => component.draft) && (
          <p className="text-xs text-amber-900">
            Some of these lists are a draft. The component owners still have to confirm them.
          </p>
        )}
        {pairs.length > 0 && (
          <ul className="space-y-1 text-sm">
            {pairs.map(({ a, b }) => (
              <li key={`${a.owner}/${a.name}-${b.owner}/${b.name}`}>
                <Link
                  href={compareHref({ owner: a.owner, repo: a.name }, { owner: b.owner, repo: b.name })}
                  className="inline-flex min-h-[44px] items-center text-cg-lightblue hover:underline sm:min-h-0"
                >
                  Compare {a.displayName ?? `${a.owner}/${a.name}`} with {b.displayName ?? `${b.owner}/${b.name}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {components.length > 0 && (
          <p className="text-sm">
            <Link
              href={buildHistoryHref({ sort: "rating", direction: "desc", functionality: functionality.id })}
              className="text-cg-lightblue hover:underline"
            >
              Show these components in the Components list
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
