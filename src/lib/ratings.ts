import type { AspectRating, CheckResult, CheckStatus, Endorsement, RequirementLevel } from "./types";
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from "./criteria";
import { ASPECT_MODEL, resolveCategory, type AspectDefinition, type CategoryAspects } from "./aspects";
import { formatStars, minimumRatingFor, ratingToStars } from "./stars";

export const MIN_RATING = 0.5;
export const MAX_RATING = 5.5;
/** The overall rating a component needs to be suitable for Common Ground. */
export const PASSING_RATING = 2.5;
/** The maintainability stars a component needs to be suitable for Common Ground: the level at which SIG and TÜViT certify. */
export const PASSING_MAINTAINABILITY_STARS = 4;
/** The maintainability rating where those stars start. */
export const PASSING_MAINTAINABILITY_RATING = minimumRatingFor(PASSING_MAINTAINABILITY_STARS);

/** Ratings of a criterion that has no scale of its own: the ends and the middle of the scale. */
const RATING_BY_STATUS: Partial<Record<CheckStatus, number>> = {
  pass: MAX_RATING,
  warn: 3,
  fail: MIN_RATING,
};

/** Document-count ratings: the lowest share of passing inputs for each rating, highest first. */
const DOCUMENT_COUNT_BANDS: Array<[share: number, rating: number]> = [
  [1, MAX_RATING],
  [0.8, 4],
  [0.6, 3],
  [0.4, 2],
];

/** The part of the scoring config the ratings are weighted with. */
export interface RatingConfig {
  criterionConfigByCheckId: Record<string, { weight: number; requirementLevel: RequirementLevel }>;
  categoryWeights?: Partial<Record<string, number>>;
}

export type RatingInput = Pick<
  CheckResult,
  "id" | "status" | "requirementLevel" | "rating" | "starRating" | "aspectRatings"
> & { title?: string; message?: string };

/** An analysis as the backend stores it; older analyses have no ratings. */
export interface StoredAnalysis {
  rating?: unknown;
  categoryRatings?: unknown;
  aspectRatings?: unknown;
  endorsement?: unknown;
  results?: unknown;
}

export interface Ratings {
  /** Overall rating from 0.5 to 5.5, or null when no category counts */
  rating: number | null;
  /** Rating per category, or null for a category without rated aspects */
  categoryRatings: Record<string, number | null>;
  /** Rating per aspect id */
  aspectRatings: Record<string, AspectRating>;
}

export function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_RATING && value <= MAX_RATING;
}

export function roundRating(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** "★★★☆☆ 3.4" */
export function formatRating(rating: number): string {
  return `${formatStars(ratingToStars(rating))} ${rating.toFixed(1)}`;
}

/**
 * A criterion's rating: its continuous rating, else its stars, else its status
 * (pass 5.5, warn 3, fail 0.5). Null for a result that was not measured.
 */
export function criterionRating(result: RatingInput): number | null {
  if (result.status === "info") return null;
  if (isRating(result.rating)) return result.rating;
  if (typeof result.starRating === "number") return result.starRating;
  return RATING_BY_STATUS[result.status] ?? null;
}

/** The rating of a share of passing documents: all 5.5, at least 80% 4, 60% 3, 40% 2, otherwise 1. */
export function documentCountRating(found: number, expected: number): number | null {
  if (expected <= 0) return null;
  const share = found / expected;
  return DOCUMENT_COUNT_BANDS.find(([minimum]) => share >= minimum)?.[1] ?? 1;
}

function weightedMean(items: Array<{ value: number; weight: number }>): number | null {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function requirementLevelOf(result: RatingInput, config: RatingConfig): RequirementLevel {
  return result.requirementLevel ?? config.criterionConfigByCheckId[result.id]?.requirementLevel ?? "recommended";
}

/** The criterion weight of a result that counts: not informative, weight above 0 and measured. */
function countedWeight(result: RatingInput | undefined, config: RatingConfig): number | null {
  if (!result || result.status === "info") return null;
  if (requirementLevelOf(result, config) === "informative") return null;
  const weight = Math.max(0, config.criterionConfigByCheckId[result.id]?.weight ?? 1);
  return weight > 0 ? weight : null;
}

function rateAspect(
  aspect: AspectDefinition,
  resultsById: Map<string, RatingInput>,
  config: RatingConfig
): { rating: number | null; found?: number; expected?: number } {
  const { source } = aspect;

  if (source.type === "check-aspect") {
    const result = resultsById.get(source.checkId);
    if (countedWeight(result, config) === null) return { rating: null };
    const value = result?.aspectRatings?.[source.key];
    return { rating: isRating(value) ? value : null };
  }

  const counted = source.checkIds.flatMap((id) => {
    const result = resultsById.get(id);
    const weight = countedWeight(result, config);
    return result && weight !== null ? [{ result, weight }] : [];
  });

  if (source.type === "document-count") {
    const found = counted.filter(({ result }) => result.status === "pass").length;
    return { rating: documentCountRating(found, counted.length), found, expected: counted.length };
  }

  return {
    rating: weightedMean(
      counted.flatMap(({ result, weight }) => {
        const value = criterionRating(result);
        return value === null ? [] : [{ value, weight }];
      })
    ),
  };
}

/**
 * Rates every aspect of the model from the check results, every category as the
 * mean of its rated aspects, and the component as the weighted mean of the
 * categories with the category weights. Ratings are rounded to one decimal;
 * each level is computed from the unrounded level below it.
 */
export function computeRatings(
  results: RatingInput[],
  config: RatingConfig,
  model: CategoryAspects[] = ASPECT_MODEL
): Ratings {
  const resultsById = new Map(results.map((result) => [result.id, result]));
  const aspectRatings: Record<string, AspectRating> = {};
  const categoryMeans = new Map<string, number | null>();

  for (const { category: modelCategory, aspects } of model) {
    const category = resolveCategory(modelCategory);
    if (!category) continue;

    const rated = aspects.map((aspect) => ({ aspect, ...rateAspect(aspect, resultsById, config) }));
    for (const { aspect, rating, found, expected } of rated) {
      aspectRatings[aspect.id] = {
        rating: rating === null ? null : roundRating(rating),
        ...(expected === undefined ? {} : { found, expected }),
      };
    }

    categoryMeans.set(
      category,
      weightedMean(
        rated.flatMap(({ aspect, rating }) =>
          rating === null ? [] : [{ value: rating, weight: Math.max(0, aspect.weight ?? 1) }]
        )
      )
    );
  }

  const categoryWeights = config.categoryWeights ?? CATEGORY_WEIGHTS;
  const overall = weightedMean(
    CATEGORY_ORDER.flatMap((category) => {
      const mean = categoryMeans.get(category) ?? null;
      const weight = Math.max(0, categoryWeights[category] ?? CATEGORY_WEIGHTS[category] ?? 0);
      return mean === null ? [] : [{ value: mean, weight }];
    })
  );

  return {
    rating: overall === null ? null : roundRating(overall),
    categoryRatings: Object.fromEntries(
      CATEGORY_ORDER.map((category) => {
        const mean = categoryMeans.get(category) ?? null;
        return [category, mean === null ? null : roundRating(mean)];
      })
    ),
    aspectRatings,
  };
}

/**
 * A component is suitable for Common Ground when no mandatory criterion fails,
 * its overall rating is at least 2.5, it has a valid maintenance contract, and
 * its estimated maintainability is at least 4 stars (3.5). It is the threshold
 * the Common Ground programme uses to decide whether to adopt a component as
 * supported, not a condition for being listed. The reasons name each failing
 * mandatory criterion, a rating that is too low, in the words of the
 * Maintenance contract criterion why there is no valid contract, and a
 * maintainability below 4 stars or not measured. A scan without the
 * maintenance criterion is not judged on it.
 */
export function computeEndorsement(
  results: RatingInput[],
  rating: number | null,
  config: RatingConfig
): Endorsement {
  const reasons = results
    .filter((result) => result.status === "fail" && requirementLevelOf(result, config) === "mandatory")
    .map((result) => `Mandatory criterion fails: ${result.title ?? result.id}`);

  if (rating === null) {
    reasons.push("No overall rating");
  } else if (rating < PASSING_RATING) {
    reasons.push(`Overall rating below ${PASSING_RATING}`);
  }

  const maintenance = results.find((result) => result.id === "maintenance");
  const alreadyCounted = maintenance?.status === "fail" && requirementLevelOf(maintenance, config) === "mandatory";
  if (maintenance && maintenance.status !== "pass" && !alreadyCounted) {
    reasons.push(
      maintenance.status === "fail"
        ? (maintenance.message ?? "No valid maintenance contract")
        : "Maintenance contract not checked"
    );
  }

  const maintainability = maintainabilityRating(results.find((result) => result.id === "maintainability"));
  if (maintainability === null) {
    reasons.push("Maintainability not measured");
  } else if (maintainability < PASSING_MAINTAINABILITY_RATING) {
    reasons.push(`Maintainability below ${PASSING_MAINTAINABILITY_STARS} stars (${maintainability.toFixed(2)})`);
  }

  return { passed: reasons.length === 0, reasons };
}

/** The measured maintainability estimate: its continuous rating, else its stars; null when it was not rated. */
function maintainabilityRating(result: RatingInput | undefined): number | null {
  if (!result || result.status === "info") return null;
  if (isRating(result.rating)) return result.rating;
  return typeof result.starRating === "number" ? result.starRating : null;
}

function parseStoredResults(raw: unknown): RatingInput[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string")
    .map((item) => ({
      id: item.id as string,
      title: typeof item.title === "string" ? item.title : undefined,
      message: typeof item.message === "string" ? item.message : undefined,
      status:
        item.status === "pass" || item.status === "warn" || item.status === "fail" || item.status === "info"
          ? item.status
          : "info",
      requirementLevel:
        item.requirementLevel === "mandatory" ||
        item.requirementLevel === "recommended" ||
        item.requirementLevel === "informative"
          ? item.requirementLevel
          : undefined,
      rating: isRating(item.rating) ? item.rating : undefined,
      starRating:
        typeof item.starRating === "number" &&
        Number.isInteger(item.starRating) &&
        item.starRating >= 1 &&
        item.starRating <= 5
          ? (item.starRating as RatingInput["starRating"])
          : undefined,
      aspectRatings: parseRatingMap(item.aspectRatings) ?? undefined,
    }));
}

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === "object" && !Array.isArray(raw);
}

function parseRatingMap(raw: unknown): Record<string, number | null> | null {
  if (!isPlainObject(raw)) return null;
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, isRating(value) ? value : null])
  );
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseStoredAspectRatings(raw: unknown): Record<string, AspectRating> | null {
  if (!isPlainObject(raw)) return null;
  return Object.fromEntries(
    Object.entries(raw).map(([id, value]) => {
      const aspect = isPlainObject(value) ? value : {};
      return [
        id,
        {
          rating: isRating(aspect.rating) ? aspect.rating : null,
          ...(isCount(aspect.found) && isCount(aspect.expected)
            ? { found: aspect.found, expected: aspect.expected }
            : {}),
        },
      ];
    })
  );
}

function parseStoredEndorsement(raw: unknown): Endorsement | null {
  if (!isPlainObject(raw) || typeof raw.passed !== "boolean" || !Array.isArray(raw.reasons)) return null;
  return { passed: raw.passed, reasons: raw.reasons.filter((reason): reason is string => typeof reason === "string") };
}

/** True when the analysis carries its own ratings, so no scoring config is needed. */
export function hasStoredRatings(analysis: StoredAnalysis): boolean {
  return (
    (analysis.rating === null || isRating(analysis.rating)) &&
    parseRatingMap(analysis.categoryRatings) !== null &&
    parseStoredAspectRatings(analysis.aspectRatings) !== null &&
    parseStoredEndorsement(analysis.endorsement) !== null
  );
}

/** The ratings and endorsement of a stored analysis, computed from its results when it has none. */
export function ratingsForStoredAnalysis(
  analysis: StoredAnalysis,
  config: RatingConfig
): Ratings & { endorsement: Endorsement } {
  if (hasStoredRatings(analysis)) {
    return {
      rating: isRating(analysis.rating) ? analysis.rating : null,
      categoryRatings: parseRatingMap(analysis.categoryRatings) ?? {},
      aspectRatings: parseStoredAspectRatings(analysis.aspectRatings) ?? {},
      endorsement: parseStoredEndorsement(analysis.endorsement) ?? { passed: false, reasons: [] },
    };
  }
  const results = parseStoredResults(analysis.results);
  const ratings = computeRatings(results, config);
  return { ...ratings, endorsement: computeEndorsement(results, ratings.rating, config) };
}
