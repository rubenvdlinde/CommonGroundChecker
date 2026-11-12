import RatingBadge from "@/components/RatingBadge";
import ResultCard from "@/components/ResultCard";
import { CATEGORY_ORDER, RESULT_CATEGORY_BY_ID, RESULT_ORDER_BY_ID } from "@/lib/criteria";
import { derivedStarRating } from "@/lib/stars";
import type { CheckResult } from "@/lib/types";

interface CriteriaResultsProps {
  results: CheckResult[];
  categoryRatings: Record<string, number | null>;
}

/** The detailed result card of every criterion of a run, grouped by category. */
export default function CriteriaResults({ results, categoryRatings }: CriteriaResultsProps) {
  return (
    <section className="space-y-1">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-600">
        Criteria results for this run
      </h3>
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50 font-semibold uppercase tracking-wide">
          High confidence
        </span>
        <span className="px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50/70 font-semibold uppercase tracking-wide">
          Medium confidence
        </span>
        <span className="px-2 py-0.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50/40 font-semibold uppercase tracking-wide">
          Low confidence
        </span>
      </div>
      <p className="mb-2 text-xs text-gray-500">
        Confidence indicates how strong the ownership evidence is: high = explicit legal statement, medium = manifest metadata, low = repository-owner fallback or weak evidence.
      </p>
      {results.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-3">
          No detailed criteria were stored for this analysis.
        </p>
      ) : (
        <div className="space-y-2">
          {CATEGORY_ORDER.map((category) => {
            const sortedResults = results
              .filter((r) => RESULT_CATEGORY_BY_ID[r.id] === category)
              .sort((a, b) => {
                const indexA = RESULT_ORDER_BY_ID.indexOf(a.id);
                const indexB = RESULT_ORDER_BY_ID.indexOf(b.id);
                const safeIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
                const safeIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
                return safeIndexA - safeIndexB;
              });

            if (sortedResults.length === 0) return null;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-3 mt-4 mb-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {category}
                  </h4>
                  <RatingBadge rating={categoryRatings[category] ?? null} label={`${category} rating`} />
                </div>
                <div className="space-y-2">
                  {sortedResults.map((result, index) => (
                    <ResultCard
                      key={`${result.id}-${index}`}
                      id={result.id}
                      title={result.title}
                      description={result.description}
                      requirementLevel={result.requirementLevel}
                      confidence={result.confidence}
                      status={result.status}
                      message={result.message}
                      evidence={result.evidence}
                      referenceUrl={result.referenceUrl}
                      starRating={derivedStarRating(result)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
