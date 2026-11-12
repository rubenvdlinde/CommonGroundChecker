import type { CheckResult, Endorsement } from "./types";
import type { CriteriaCategory } from "./criteria";
import { CATEGORY_ORDER, RESULT_CATEGORY_BY_ID, RESULT_ORDER_BY_ID } from "./criteria";
import { PASSING_RATING } from "./ratings";

export interface IssueEntry {
  result: CheckResult;
  category: CriteriaCategory;
}

export interface IssueSplit {
  errors: IssueEntry[];
  warnings: IssueEntry[];
}

function resultSortIndex(result: CheckResult, category: CriteriaCategory): [number, number] {
  const orderIndex = RESULT_ORDER_BY_ID.indexOf(result.id);
  return [
    CATEGORY_ORDER.indexOf(category),
    orderIndex === -1 ? Number.MAX_SAFE_INTEGER : orderIndex,
  ];
}

/**
 * Splits results into errors (mandatory criteria that fail) and warnings
 * (recommended criteria that fail or warn, and mandatory criteria that warn).
 * Results with status `info`, informative criteria and results without a
 * category (which have no card in the result list) are left out. A result
 * without a requirement level counts as recommended, as in ResultCard.
 */
export function splitIssues(results: CheckResult[]): IssueSplit {
  const errors: IssueEntry[] = [];
  const warnings: IssueEntry[] = [];

  const entries = results
    .filter((result) => RESULT_CATEGORY_BY_ID[result.id] !== undefined)
    .map((result) => ({ result, category: RESULT_CATEGORY_BY_ID[result.id] }))
    .sort((a, b) => {
      const [categoryA, orderA] = resultSortIndex(a.result, a.category);
      const [categoryB, orderB] = resultSortIndex(b.result, b.category);
      return categoryA - categoryB || orderA - orderB;
    });

  for (const entry of entries) {
    const level = entry.result.requirementLevel ?? "recommended";
    const { status } = entry.result;

    if (level === "mandatory" && status === "fail") {
      errors.push(entry);
    } else if (
      (level === "mandatory" && status === "warn") ||
      (level === "recommended" && (status === "fail" || status === "warn"))
    ) {
      warnings.push(entry);
    }
  }

  return { errors, warnings };
}

/** The id of the rating summary, which the rating error links to. */
export const RATING_SUMMARY_ID = "rating-summary";

/**
 * The error for an endorsement that fails on the overall rating: a rating
 * below 2.5, or no rating at all. Null when the endorsement passes, is
 * missing or fails only on mandatory criteria.
 */
export function ratingIssue(rating: number | null, endorsement: Endorsement | null | undefined): string | null {
  if (!endorsement || endorsement.passed) return null;
  if (rating === null) return "No overall rating";
  if (rating < PASSING_RATING) return `Overall rating ${rating.toFixed(1)} is below ${PASSING_RATING}`;
  return null;
}

export interface IssueCounts {
  errors: number;
  warnings: number;
}

/** The counts in the headings of the errors and warnings blocks. */
export function countIssues(
  results: CheckResult[],
  rating: number | null,
  endorsement: Endorsement | null | undefined
): IssueCounts {
  const { errors, warnings } = splitIssues(results);
  return {
    errors: errors.length + (ratingIssue(rating, endorsement) === null ? 0 : 1),
    warnings: warnings.length,
  };
}
