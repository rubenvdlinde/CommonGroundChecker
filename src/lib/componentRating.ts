import { ASPECT_MODEL, resolveCategory, type AspectDefinition } from "./aspects";
import { RESULT_CATEGORY_BY_ID, type CriteriaCategory } from "./criteria";
import { measurementsForAspect } from "./measurements";
import { RATING_DOCS } from "./ratingDocs";
import { MAX_RATING, MIN_RATING, criterionRating } from "./ratings";
import type { AspectRating, CheckResult, CheckStatus, InformativeMetric, MeasurementGroup, UsageSource } from "./types";
import { USAGE_CHECK_ID, shownUsageSources } from "./usage";

/** The ratings where the rounded stars change: 1.5, 2.5, 3.5 and 4.5. */
export const STAR_BOUNDARIES = [1.5, 2.5, 3.5, 4.5] as const;

/** The rating that fills the bar: the top of the 0.5 to 5.5 scale. */
export const BAR_MAX_RATING = MAX_RATING;

/** Where a rating lies on the 0.5 to 5.5 scale, in percent of the bar; null and out-of-range values are clamped. */
export function ratingPercent(rating: number | null): number {
  if (rating === null || !Number.isFinite(rating)) return 0;
  const clamped = Math.min(BAR_MAX_RATING, Math.max(MIN_RATING, rating));
  return Math.round(((clamped - MIN_RATING) / (BAR_MAX_RATING - MIN_RATING)) * 1000) / 10;
}

/** The positions of the star boundaries on the bar, in percent. */
export function tickPercents(): number[] {
  return STAR_BOUNDARIES.map((boundary) => ratingPercent(boundary));
}

/** "Testability 1.8 of 5.5" */
export function meterLabel(title: string, rating: number): string {
  return `${title} ${rating.toFixed(1)} of ${BAR_MAX_RATING}`;
}

/** "4 of 5 found" for a document-count aspect, otherwise null. */
export function documentCountText(aspectRating: AspectRating | undefined): string | null {
  if (aspectRating?.expected === undefined) return null;
  return `${aspectRating.found ?? 0} of ${aspectRating.expected} found`;
}

/** Aspect sources that give an aspect stars; any other source shows information without a rating. */
const RATED_SOURCES: ReadonlySet<string> = new Set(["criteria", "document-count", "check-aspect"]);

/**
 * The note after an aspect's name: "informative, not rated" for an aspect that
 * never gets stars, "not counted" for one that has stars but weight 0.
 */
export function aspectNote(aspect: AspectDefinition): string | null {
  if (!RATED_SOURCES.has(aspect.source.type)) return "informative, not rated";
  return aspect.weight === 0 ? "not counted" : null;
}

/** The slug of a category's page in the rating guide. */
export function categoryDocSlug(category: CriteriaCategory): string | undefined {
  const modelCategory = ASPECT_MODEL.find((entry) => resolveCategory(entry.category) === category)?.category;
  return RATING_DOCS.find((doc) => doc.title === modelCategory || doc.title === category)?.slug;
}

export function aspectsOfCategory(category: CriteriaCategory): AspectDefinition[] {
  return ASPECT_MODEL.find((entry) => resolveCategory(entry.category) === category)?.aspects ?? [];
}

/** A criterion an aspect is made of, as shown in the aspect's table. */
export interface AspectCriterion {
  id: string;
  title: string;
  status: CheckStatus;
  /** Its rating from 0.5 to 5.5, or null when it was not measured */
  rating: number | null;
  /** True when the report has a result card for it to link to */
  hasCard: boolean;
}

/** What an aspect is made of: the measurements of its check, or the criteria it is rated from. */
export type AspectComposition =
  | { type: "measurements"; groups: MeasurementGroup[] }
  | { type: "metrics"; metrics: InformativeMetric[] }
  | { type: "documents"; criteria: AspectCriterion[] }
  | { type: "criteria"; criteria: AspectCriterion[] }
  | { type: "usage"; sources: UsageSource[] };

function aspectCriterion(result: CheckResult): AspectCriterion {
  return {
    id: result.id,
    title: result.title,
    status: result.status,
    rating: criterionRating(result),
    hasCard: RESULT_CATEGORY_BY_ID[result.id] !== undefined,
  };
}

/**
 * The inputs of an aspect in the report. An aspect a check rates itself shows
 * the check's measurements for it, or the check as a criterion when it has none.
 * An informative aspect shows the sources its check measured.
 */
export function aspectComposition(aspect: AspectDefinition, results: CheckResult[]): AspectComposition {
  const resultsById = new Map(results.map((result) => [result.id, result]));
  const { source } = aspect;

  if (source.type === "informative") {
    if (source.checkId === USAGE_CHECK_ID) {
      return { type: "usage", sources: shownUsageSources(resultsById.get(source.checkId)?.usage) };
    }
    return { type: "metrics", metrics: resultsById.get(source.checkId)?.metrics ?? [] };
  }

  if (source.type === "check-aspect") {
    const result = resultsById.get(source.checkId);
    const groups = measurementsForAspect(result?.measurements, source.key);
    if (groups.length > 0) return { type: "measurements", groups };
    return { type: "criteria", criteria: result ? [aspectCriterion(result)] : [] };
  }

  const criteria = source.checkIds.flatMap((id) => {
    const result = resultsById.get(id);
    return result ? [aspectCriterion(result)] : [];
  });
  return { type: source.type === "document-count" ? "documents" : "criteria", criteria };
}
