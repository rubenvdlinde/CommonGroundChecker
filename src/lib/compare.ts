/**
 * Two components side by side: per rating, aspect and criterion, which one
 * scores better. A higher rating is better; a value that one side lacks, or
 * that is informative, is not comparable.
 */
import { ASPECT_MODEL } from "./aspects";
import { CATEGORY_ORDER, RESULT_CATEGORY_BY_ID, RESULT_ORDER_BY_ID } from "./criteria";
import { criterionRating, isRating } from "./ratings";
import { COMPARE_PATH } from "./routes";
import type { CheckResult, CheckStatus } from "./types";

export type Winner = "a" | "b" | "equal" | "not-comparable";

/** Ratings closer than this are equal: they are shown with one decimal. */
const EQUAL_WITHIN = 0.05;

export function compareRatings(a: number | null | undefined, b: number | null | undefined): Winner {
  if (!isRating(a) || !isRating(b)) return "not-comparable";
  if (Math.abs(a - b) < EQUAL_WITHIN) return "equal";
  return a > b ? "a" : "b";
}

export interface RatingRow {
  id: string;
  title: string;
  a: number | null;
  b: number | null;
  winner: Winner;
}

export interface CriterionSide {
  status: CheckStatus;
  rating: number | null;
  message: string;
}

export interface CriterionRow {
  id: string;
  title: string;
  category: string | null;
  a: CriterionSide | null;
  b: CriterionSide | null;
  winner: Winner;
}

export interface ComparedAnalysis {
  rating: number | null;
  categoryRatings: Record<string, number | null> | null;
  aspectRatings: Record<string, { rating: number | null } | null | undefined> | null;
  results: Array<Pick<CheckResult, "id" | "title" | "status" | "message" | "rating" | "starRating" | "notApplicable">>;
}

function ratingOf(value: unknown): number | null {
  return isRating(value) ? value : null;
}

/** The overall rating, then each category in the usual order. */
export function compareCategoryRatings(a: ComparedAnalysis, b: ComparedAnalysis): RatingRow[] {
  const rows: RatingRow[] = [
    { id: "overall", title: "Overall rating", a: ratingOf(a.rating), b: ratingOf(b.rating), winner: "not-comparable" },
    ...CATEGORY_ORDER.map((category) => ({
      id: category,
      title: category,
      a: ratingOf(a.categoryRatings?.[category]),
      b: ratingOf(b.categoryRatings?.[category]),
      winner: "not-comparable" as Winner,
    })),
  ];
  return rows.map((row) => ({ ...row, winner: compareRatings(row.a, row.b) }));
}

/** Every aspect of the rating model, grouped by category, with the rating each side has. */
export function compareAspectRatings(a: ComparedAnalysis, b: ComparedAnalysis): Array<{ category: string; rows: RatingRow[] }> {
  return ASPECT_MODEL.map(({ category, aspects }) => ({
    category,
    rows: aspects.map((aspect) => {
      const ratingA = ratingOf(a.aspectRatings?.[aspect.id]?.rating);
      const ratingB = ratingOf(b.aspectRatings?.[aspect.id]?.rating);
      return { id: aspect.id, title: aspect.title, a: ratingA, b: ratingB, winner: compareRatings(ratingA, ratingB) };
    }),
  }));
}

function side(result: ComparedAnalysis["results"][number] | undefined): CriterionSide | null {
  if (!result) return null;
  return { status: result.status, rating: criterionRating(result), message: result.message };
}

/** Every criterion either side measured, in the order of the checklist. */
export function compareCriteria(a: ComparedAnalysis, b: ComparedAnalysis): CriterionRow[] {
  const byIdA = new Map(a.results.map((result) => [result.id, result]));
  const byIdB = new Map(b.results.map((result) => [result.id, result]));
  const ids = [...new Set([...byIdA.keys(), ...byIdB.keys()])];
  const order = (id: string) => {
    const index = RESULT_ORDER_BY_ID.indexOf(id);
    return index < 0 ? RESULT_ORDER_BY_ID.length : index;
  };
  ids.sort((x, y) => order(x) - order(y) || x.localeCompare(y));
  return ids.map((id) => {
    const resultA = byIdA.get(id);
    const resultB = byIdB.get(id);
    const sideA = side(resultA);
    const sideB = side(resultB);
    return {
      id,
      title: resultA?.title ?? resultB?.title ?? id,
      category: RESULT_CATEGORY_BY_ID[id] ?? null,
      a: sideA,
      b: sideB,
      winner: compareRatings(sideA?.rating, sideB?.rating),
    };
  });
}

/** How often each side scores better, over the rows that are comparable. */
export function tallyWinners(rows: Array<{ winner: Winner }>): Record<Winner, number> {
  const tally: Record<Winner, number> = { a: 0, b: 0, equal: 0, "not-comparable": 0 };
  for (const row of rows) tally[row.winner] += 1;
  return tally;
}

/** A component as the compare page names it in the URL: owner/repo, where a GitLab owner can hold slashes. */
export interface ComponentKey {
  owner: string;
  repo: string;
}

export function parseComponentKey(value: string | string[] | null | undefined): ComponentKey | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim().replace(/^\/+|\/+$/g, "");
  if (!raw) return null;
  const slash = raw.lastIndexOf("/");
  if (slash <= 0 || slash === raw.length - 1) return null;
  return { owner: raw.slice(0, slash), repo: raw.slice(slash + 1) };
}

export function componentKeyText(key: ComponentKey): string {
  return `${key.owner}/${key.repo}`;
}

/** /compare?a=owner/repo&b=owner/repo; either side may be left out. */
export function compareHref(a: ComponentKey | null, b: ComponentKey | null): string {
  const params = new URLSearchParams();
  if (a) params.set("a", componentKeyText(a));
  if (b) params.set("b", componentKeyText(b));
  const query = params.toString().replace(/%2F/g, "/");
  return query ? `${COMPARE_PATH}?${query}` : COMPARE_PATH;
}
