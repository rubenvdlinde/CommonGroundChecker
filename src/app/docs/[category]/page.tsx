import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CODE_PROPERTIES,
  RATING_DOCS,
  codeProperty,
  findCategoryDoc,
  type RatingAspectDoc,
} from "@/lib/ratingDocs";
import { TOOLS_DOC_HREF, TOOLS_DOC_LINKED_FROM } from "@/lib/toolsDocs";

interface CategoryDocPageProps {
  params: Promise<{ category: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return RATING_DOCS.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: CategoryDocPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = findCategoryDoc(slug);
  return category
    ? { title: `${category.title} | Rating guide`, description: category.summary }
    : { title: "Rating guide" };
}

function CodePropertyTable() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left border border-gray-200">
        <caption className="text-left text-gray-700 pb-2">
          Star limits per code property. The 4-star limits are published in the maintainability guidance. The 5,
          3 and 2-star limits are derived by the checker. Anything worse than 2 stars is 1 star.
        </caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="p-2">Property</th>
            <th scope="col" className="p-2">What is measured</th>
            <th scope="col" className="p-2">5 stars (derived)</th>
            <th scope="col" className="p-2">4 stars (published)</th>
            <th scope="col" className="p-2">3 stars (derived)</th>
            <th scope="col" className="p-2">2 stars (derived)</th>
          </tr>
        </thead>
        <tbody>
          {CODE_PROPERTIES.map((property) => (
            <tr key={property.id} className="border-t border-gray-200">
              <th scope="row" className="p-2 font-medium">{property.title}</th>
              <td className="p-2">{property.measures}</td>
              <td className="p-2">{property.derived.fiveStars}</td>
              <td className="p-2">{property.fourStars}</td>
              <td className="p-2">{property.derived.threeStars ?? "no level"}</td>
              <td className="p-2">{property.derived.twoStars ?? "no level"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AspectSection({ aspect }: { aspect: RatingAspectDoc }) {
  const headingId = `${aspect.id}-heading`;
  return (
    <section
      id={aspect.id}
      aria-labelledby={headingId}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 scroll-mt-6"
    >
      <h2 id={headingId} className="text-2xl font-bold text-cg-blue">
        {aspect.title}
      </h2>
      {!aspect.counted && (
        <p className="text-sm font-semibold text-gray-700">Shown in the report, but not counted in the rating.</p>
      )}

      <h3 className="text-lg font-semibold text-gray-800">What it means</h3>
      <p className="text-gray-700">{aspect.meaning}</p>

      <h3 className="text-lg font-semibold text-gray-800">How the checker measures it</h3>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        {aspect.criteria.map((criterion) => (
          <li key={criterion.checkId}>
            <strong>{criterion.name}</strong>, measured with {criterion.tool}.
          </li>
        ))}
      </ul>
      {aspect.properties && (
        <>
          <p className="text-gray-700">Measured through these code properties, with their 4-star limits:</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            {aspect.properties.map((id) => {
              const property = codeProperty(id);
              return (
                <li key={id}>
                  <strong>{property.title}</strong>: {property.fourStars}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {aspect.rating.map((paragraph) => (
        <p key={paragraph} className="text-gray-700">
          {paragraph}
        </p>
      ))}

      <h3 className="text-lg font-semibold text-gray-800">Sources</h3>
      <ul className="list-disc pl-6 space-y-1">
        {aspect.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} className="text-cg-lightblue hover:underline" rel="noopener noreferrer">
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function CategoryDocPage({ params }: CategoryDocPageProps) {
  const { category: slug } = await params;
  const category = findCategoryDoc(slug);
  if (!category) notFound();

  const hasCodeProperties = category.aspects.some((aspect) => aspect.properties);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="space-y-3">
        <p className="text-sm">
          <Link href="/docs" className="text-cg-lightblue hover:underline">
            Back to the rating guide
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-cg-blue">{category.title}</h1>
        <p className="text-gray-700">{category.summary}</p>
        {TOOLS_DOC_LINKED_FROM.includes(category.slug) && (
          <p className="text-gray-700">
            Which tools measure each property, and where the checker deviates from the SIG/TÜV NORD model, is on{" "}
            <Link href={TOOLS_DOC_HREF} className="text-cg-lightblue hover:underline">
              Tools and models
            </Link>
            .
          </p>
        )}
        <nav aria-label={`Aspects of ${category.title}`}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {category.aspects.map((aspect) => (
              <li key={aspect.id}>
                <a href={`#${aspect.id}`} className="text-cg-lightblue hover:underline">
                  {aspect.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {hasCodeProperties && (
        <section aria-labelledby="code-properties" className="space-y-3">
          <h2 id="code-properties" className="text-2xl font-bold text-cg-blue">
            Code properties and star limits
          </h2>
          <CodePropertyTable />
        </section>
      )}

      {category.aspects.map((aspect) => (
        <AspectSection key={aspect.id} aspect={aspect} />
      ))}
    </div>
  );
}
