import AspectBar from "@/components/AspectBar";
import MeasurementTable, { StarsText } from "@/components/MeasurementTable";
import MetricTable from "@/components/MetricTable";
import RatingBadge from "@/components/RatingBadge";
import UsageTable from "@/components/UsageTable";
import SizeTable from "@/components/SizeTable";
import { resolveCategory, type AspectDefinition } from "@/lib/aspects";
import {
  aspectComposition,
  aspectNote,
  aspectsOfCategory,
  categoryDocSlug,
  documentCountText,
  type AspectCriterion,
} from "@/lib/componentRating";
import { CATEGORY_ORDER, criterionAnchorId, type CriteriaCategory } from "@/lib/criteria";
import { aspectDocHref } from "@/lib/ratingDocs";
import { sizeSummary } from "@/lib/size";
import { ratingToStars } from "@/lib/stars";
import type { AspectRating, CheckResult, CheckStatus, UsageSource } from "@/lib/types";

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center lg:min-h-0 text-cg-lightblue underline hover:text-cg-blue rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cg-blue";

const STATUS_LABELS: Record<CheckStatus, string> = {
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
  info: "Not measured",
};

function documentLabel(status: CheckStatus): string {
  if (status === "pass") return "Found";
  if (status === "info") return "Not measured";
  return "Missing";
}

function CriterionName({ criterion }: { criterion: AspectCriterion }) {
  if (!criterion.hasCard) return <>{criterion.title}</>;
  return (
    <a href={`#${criterionAnchorId(criterion.id)}`} className={LINK_CLASS}>
      {criterion.title}
      <span className="sr-only">: go to the {criterion.title} result</span>
    </a>
  );
}

function CriterionTable({
  caption,
  criteria,
  documents,
}: {
  caption: string;
  criteria: AspectCriterion[];
  documents: boolean;
}) {
  return (
    <div className="relative overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="min-w-full text-xs text-left border border-gray-200">
        <caption className="text-left text-gray-600 pb-1">{caption}</caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="px-2 py-1">{documents ? "Document" : "Criterion"}</th>
            <th scope="col" className="px-2 py-1">{documents ? "Found" : "Status"}</th>
            {!documents && <th scope="col" className="px-2 py-1">Stars</th>}
          </tr>
        </thead>
        <tbody>
          {criteria.map((criterion) => (
            <tr key={criterion.id} className="border-t border-gray-100">
              <th scope="row" className="px-2 py-1 font-normal text-gray-800">
                <CriterionName criterion={criterion} />
              </th>
              <td className="px-2 py-1 text-gray-800">
                {documents ? documentLabel(criterion.status) : STATUS_LABELS[criterion.status]}
              </td>
              {!documents && (
                <td className="px-2 py-1 whitespace-nowrap text-gray-800">
                  {criterion.rating === null ? (
                    <span className="text-gray-600">not measured</span>
                  ) : (
                    <>
                      <StarsText stars={ratingToStars(criterion.rating)} /> {criterion.rating.toFixed(1)}
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AspectComposition({ aspect, results }: { aspect: AspectDefinition; results: CheckResult[] }) {
  const composition = aspectComposition(aspect, results);
  const caption = `What ${aspect.title} is made of`;

  if (composition.type === "measurements") {
    return <MeasurementTable caption={caption} groups={composition.groups} />;
  }
  if (composition.type === "usage") {
    return <UsageTable caption={caption} sources={composition.sources} />;
  }
  if (composition.type === "metrics") {
    if (composition.metrics.length === 0) return <p className="text-xs text-gray-600">It was not measured.</p>;
    return <MetricTable caption={caption} metrics={composition.metrics} />;
  }
  if (composition.type === "size") {
    if (composition.size) return <SizeTable caption={caption} size={composition.size} />;
    return <p className="text-xs text-gray-600">{composition.message ?? "Size was not measured."}</p>;
  }
  if (composition.criteria.length === 0) {
    return <p className="text-xs text-gray-600">None of its criteria were checked.</p>;
  }
  return (
    <CriterionTable caption={caption} criteria={composition.criteria} documents={composition.type === "documents"} />
  );
}

function AspectValue({ aspect, aspectRating }: { aspect: AspectDefinition; aspectRating?: AspectRating }) {
  const rating = aspectRating?.rating ?? null;
  if (aspect.source.type === "informative") return null;
  if (rating === null) return <span className="text-xs text-gray-600">not measured</span>;
  const count = documentCountText(aspectRating);
  return (
    <span className="inline-flex items-baseline gap-2">
      <RatingBadge rating={rating} label={`${aspect.title} rating`} />
      {count && <span className="text-xs text-gray-700">{count}</span>}
    </span>
  );
}

/** A size aspect is not rated: it shows the lines of code in place of a bar and a rating. */
function SizeValue({ aspect, results }: { aspect: AspectDefinition; results: CheckResult[] }) {
  const composition = aspectComposition(aspect, results);
  const size = composition.type === "size" ? composition.size : null;
  return (
    <span className="text-sm text-gray-800 sm:col-span-2">
      {size ? sizeSummary(size) : <span className="text-xs text-gray-600">not measured</span>}
    </span>
  );
}

function AspectRow({
  aspect,
  aspectRating,
  results,
  docSlug,
}: {
  aspect: AspectDefinition;
  aspectRating?: AspectRating;
  results: CheckResult[];
  docSlug?: string;
}) {
  const headingId = `aspect-rating-${aspect.id}`;
  const note = aspectNote(aspect);
  return (
    <div role="group" aria-labelledby={headingId} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_11rem] sm:items-center">
        <AspectHeading
          aspect={aspect}
          docSlug={docSlug}
          headingId={headingId}
          note={note}
        />
        {aspect.source.type === "size" ? (
          <SizeValue aspect={aspect} results={results} />
        ) : (
          <>
            {aspect.source.type === "informative" ? (
              <p className="text-xs text-gray-600">Shown for information, without stars.</p>
            ) : (
              <AspectBar title={aspect.title} rating={aspectRating?.rating ?? null} />
            )}
            <AspectValue aspect={aspect} aspectRating={aspectRating} />
          </>
        )}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer py-3.5 lg:py-0 text-xs text-cg-lightblue focus-visible:outline focus-visible:outline-2 focus-visible:outline-cg-lightblue">
          Show what {aspect.title} is made of
        </summary>
        <div className="mt-2">
          <AspectComposition aspect={aspect} results={results} />
        </div>
      </details>
    </div>
  );
}

function AspectHeading({ aspect, docSlug, headingId, note }: { aspect: AspectDefinition; docSlug?: string; headingId: string; note: string | null }) {
  return (
    <h5 id={headingId} className="text-sm font-semibold text-gray-800">
      {docSlug ? (
        <a href={aspectDocHref(docSlug, aspect.id)} className={LINK_CLASS}>
          {aspect.title}
        </a>
      ) : (
        aspect.title
      )}
      {note && <span className="ml-1 text-xs font-normal text-gray-600">({note})</span>}
    </h5>
  );
}

/** An aspect that is shown but never rated: no bar and no stars, only what each source measured. */
function InformativeAspectRow({
  aspect,
  sources,
  docSlug,
}: {
  aspect: AspectDefinition;
  sources: UsageSource[];
  docSlug?: string;
}) {
  const headingId = `aspect-rating-${aspect.id}`;
  return (
    <div role="group" aria-labelledby={headingId} className="space-y-2">
      <AspectHeading aspect={aspect} docSlug={docSlug} headingId={headingId} note={aspectNote(aspect)} />
      <p className="text-xs text-gray-600">
        Each source is shown on its own, with its date and caveat. The figures are not added up, rated or compared
        with other components.
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer py-3.5 lg:py-0 text-xs text-cg-lightblue focus-visible:outline focus-visible:outline-2 focus-visible:outline-cg-lightblue">
          Show what {aspect.title} is made of
        </summary>
        <div className="mt-2">
          <UsageTable caption={`What the sources say about ${aspect.title}`} sources={sources} />
        </div>
      </details>
    </div>
  );
}

/** The open-track rating, shown next to the estimate of the Maintainability category without counting it. */
function OpenTrackLine({ results }: { results: CheckResult[] }) {
  const openTrack = results.find((result) => result.id === "opentrack");
  if (typeof openTrack?.rating !== "number") return null;
  return (
    <p className="text-sm text-gray-800">
      <a href={`#${criterionAnchorId(openTrack.id)}`} className={LINK_CLASS}>
        Open track
      </a>
      : {openTrack.rating.toFixed(1)} <StarsText stars={ratingToStars(openTrack.rating)} />{" "}
      <span className="text-xs text-gray-600">(informative, not counted)</span>
    </p>
  );
}

function CategorySection({
  category,
  rating,
  aspectRatings,
  results,
}: {
  category: CriteriaCategory;
  rating: number | null;
  aspectRatings: Record<string, AspectRating>;
  results: CheckResult[];
}) {
  const aspects = aspectsOfCategory(category);
  const docSlug = categoryDocSlug(category);
  const headingId = `category-rating-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section aria-labelledby={headingId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h4 id={headingId} className="text-lg font-semibold text-cg-blue">
          {docSlug ? (
            <a href={`/docs/${docSlug}`} className={LINK_CLASS}>
              {category}
            </a>
          ) : (
            category
          )}
        </h4>
        <RatingBadge rating={rating} label={`${category} rating`} />
      </div>
      {category === resolveCategory("Maintainability") && <OpenTrackLine results={results} />}
      {aspects.map((aspect) => {
        const composition = aspect.source.type === "informative" ? aspectComposition(aspect, results) : null;
        if (composition?.type === "usage") {
          const sources = composition.sources;
          return sources.length > 0 ? (
            <InformativeAspectRow key={aspect.id} aspect={aspect} sources={sources} docSlug={docSlug} />
          ) : null;
        }
        return (
          <AspectRow
            key={aspect.id}
            aspect={aspect}
            aspectRating={aspectRatings[aspect.id]}
            results={results}
            docSlug={docSlug}
          />
        );
      })}
    </section>
  );
}

interface CategoryRatingsProps {
  results: CheckResult[];
  categoryRatings: Record<string, number | null>;
  aspectRatings: Record<string, AspectRating>;
}

/** One section per category with a bar per aspect and a table of what each aspect is made of. */
export default function CategoryRatings({ results, categoryRatings, aspectRatings }: CategoryRatingsProps) {
  return (
    <section aria-labelledby="category-ratings-heading" className="space-y-4">
      <h3 id="category-ratings-heading" className="font-semibold text-sm uppercase tracking-wide text-gray-600">
        Rating per category and aspect
      </h3>
      <p className="text-xs text-gray-600">
        Each bar runs from 0.5 to 5.5; the marks are where the stars change, at 1.5, 2.5, 3.5 and 4.5.
      </p>
      {CATEGORY_ORDER.filter((category) => aspectsOfCategory(category).length > 0).map((category) => (
        <CategorySection
          key={category}
          category={category}
          rating={categoryRatings[category] ?? null}
          aspectRatings={aspectRatings}
          results={results}
        />
      ))}
    </section>
  );
}
