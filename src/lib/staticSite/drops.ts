/**
 * Drops between two analyses of the same repository, scanned ref kind and
 * checklist version: a criterion from pass to fail, a rating that lost a
 * whole star, or the verdict "suitable for Common Ground" that was lost.
 * Same rules and default fix terms as the backend (src/lib/drops.ts and
 * src/lib/maintenanceTerms.ts there), so a static site and a server agree.
 */

import { storedCategoryRatings } from "@/lib/ratings";

export type DropKind = "criterion" | "rating" | "verdict";

export const OVERALL_RATING_SUBJECT = "overall";
export const VERDICT_SUBJECT = "suitable";

/** The parts of an analysis drops are measured on. */
export interface DropSnapshot {
  /** Criterion id to its status and title; informative criteria are left out */
  criteria: Record<string, { status: string; title: string; requirementLevel?: string }>;
  rating: number | null;
  categoryRatings: Record<string, number | null>;
  suitable: boolean | null;
}

export interface DetectedDrop {
  kind: DropKind;
  subject: string;
  label: string;
  from: string;
  to: string;
  requirementLevel?: string;
}

/** A drop as history.json keeps it. */
export interface DropRecord {
  id: string;
  analysisId: string;
  previousAnalysisId: string;
  scannedRefKind: string | null;
  checklistVersion: string | null;
  kind: DropKind;
  subject: string;
  label: string;
  from: string;
  to: string;
  detectedAt: string;
  fixTermDays: number;
  fixBy: string;
  resolvedAt: string | null;
  resolvedAnalysisId: string | null;
}

export interface FixTerms {
  criteria: Record<string, number>;
  ratings: Record<string, number>;
  mandatory: number;
  recommended: number;
  rating: number;
  verdict: number;
}

export const DEFAULT_FIX_TERMS: FixTerms = {
  criteria: { opensourcehealth: 14, secretscanning: 14 },
  ratings: { Maintainability: 90 },
  mandatory: 30,
  recommended: 90,
  rating: 60,
  verdict: 30,
};

/** The snapshot of stored check results, ratings and endorsement. */
export function snapshotOf(analysis: {
  results?: unknown;
  rating?: unknown;
  categoryRatings?: unknown;
  endorsement?: unknown;
}): DropSnapshot {
  const criteria: DropSnapshot["criteria"] = {};
  if (Array.isArray(analysis.results)) {
    for (const item of analysis.results) {
      if (!item || typeof item !== "object") continue;
      const { id, status, title, requirementLevel } = item as Record<string, unknown>;
      if (typeof id !== "string" || typeof status !== "string" || id in criteria) continue;
      criteria[id] = {
        status,
        title: typeof title === "string" && title ? title : id,
        ...(typeof requirementLevel === "string" ? { requirementLevel } : {}),
      };
    }
  }
  const categoryRatings = storedCategoryRatings(analysis.categoryRatings);
  const passed = (analysis.endorsement as { passed?: unknown } | null | undefined)?.passed;
  return {
    criteria,
    rating: isRatingValue(analysis.rating) ? analysis.rating : null,
    categoryRatings,
    suitable: typeof passed === "boolean" ? passed : null,
  };
}

function isRatingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Whole stars of a 0.5 to 5.5 rating: x.5 rounds up, 1 to 5. */
export function ratingStars(rating: number): number {
  return Math.min(5, Math.max(1, Math.floor(rating + 0.5)));
}

function ratingsBySubject(snapshot: DropSnapshot): Map<string, number> {
  const ratings = new Map<string, number>();
  if (snapshot.rating !== null) ratings.set(OVERALL_RATING_SUBJECT, snapshot.rating);
  for (const [category, rating] of Object.entries(snapshot.categoryRatings)) {
    if (rating !== null && category !== OVERALL_RATING_SUBJECT) ratings.set(category, rating);
  }
  return ratings;
}

function ratingLabel(subject: string): string {
  return subject === OVERALL_RATING_SUBJECT ? "Overall rating" : `${subject} rating`;
}

export function detectDrops(previous: DropSnapshot, current: DropSnapshot): DetectedDrop[] {
  const drops: DetectedDrop[] = [];
  for (const [id, now] of Object.entries(current.criteria)) {
    if (now.requirementLevel === "informative") continue;
    if (previous.criteria[id]?.status === "pass" && now.status === "fail") {
      drops.push({ kind: "criterion", subject: id, label: now.title, from: "pass", to: "fail", requirementLevel: now.requirementLevel });
    }
  }
  const before = ratingsBySubject(previous);
  for (const [subject, rating] of ratingsBySubject(current)) {
    const earlier = before.get(subject);
    if (earlier === undefined) continue;
    const from = ratingStars(earlier);
    const to = ratingStars(rating);
    if (to < from) drops.push({ kind: "rating", subject, label: ratingLabel(subject), from: String(from), to: String(to) });
  }
  if (previous.suitable === true && current.suitable === false) {
    drops.push({ kind: "verdict", subject: VERDICT_SUBJECT, label: "Suitable for Common Ground", from: "suitable", to: "not suitable" });
  }
  return drops;
}

export function isRecovered(drop: Pick<DropRecord, "kind" | "subject" | "from">, current: DropSnapshot): boolean {
  if (drop.kind === "criterion") return current.criteria[drop.subject]?.status === "pass";
  if (drop.kind === "rating") {
    const rating = ratingsBySubject(current).get(drop.subject);
    return rating !== undefined && ratingStars(rating) >= Number(drop.from);
  }
  return current.suitable === true;
}

export function fixTermDays(drop: Pick<DetectedDrop, "kind" | "subject" | "requirementLevel">, terms: FixTerms): number {
  if (drop.kind === "criterion") {
    return terms.criteria[drop.subject] ?? (drop.requirementLevel === "mandatory" ? terms.mandatory : terms.recommended);
  }
  if (drop.kind === "rating") return terms.ratings[drop.subject] ?? terms.rating;
  return terms.verdict;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScannedAnalysis {
  id: string;
  checkedAt: string;
  scannedRefKind: string | null;
  checklistVersion: string | null;
  snapshot: DropSnapshot;
}

/**
 * The drops after a new analysis. Open drops of the same ref kind that it
 * recovers are resolved. New drops are only detected against the previous
 * analysis of the same ref kind and checklist version, so a change of the
 * checklist or of what is scanned starts a new baseline. A subject with an
 * open drop gets no second one.
 */
export function updateDrops(
  drops: DropRecord[],
  previous: ScannedAnalysis | null,
  current: ScannedAnalysis,
  terms: FixTerms = DEFAULT_FIX_TERMS
): { drops: DropRecord[]; created: DropRecord[] } {
  const stillOpen = new Set<string>();
  const updated = drops.map((drop) => {
    if (drop.resolvedAt !== null || drop.scannedRefKind !== current.scannedRefKind) return drop;
    if (drop.detectedAt < current.checkedAt && isRecovered(drop, current.snapshot)) {
      return { ...drop, resolvedAt: current.checkedAt, resolvedAnalysisId: current.id };
    }
    stillOpen.add(`${drop.kind}:${drop.subject}`);
    return drop;
  });

  const created: DropRecord[] = [];
  const comparable =
    previous !== null &&
    current.checklistVersion !== null &&
    previous.checklistVersion === current.checklistVersion &&
    previous.scannedRefKind === current.scannedRefKind &&
    previous.checkedAt < current.checkedAt;
  if (comparable) {
    for (const drop of detectDrops(previous.snapshot, current.snapshot)) {
      if (stillOpen.has(`${drop.kind}:${drop.subject}`)) continue;
      const days = fixTermDays(drop, terms);
      created.push({
        id: `${current.id}-${drop.kind}-${drop.subject}`,
        analysisId: current.id,
        previousAnalysisId: previous.id,
        scannedRefKind: current.scannedRefKind,
        checklistVersion: current.checklistVersion,
        kind: drop.kind,
        subject: drop.subject,
        label: drop.label,
        from: drop.from,
        to: drop.to,
        detectedAt: current.checkedAt,
        fixTermDays: days,
        fixBy: new Date(new Date(current.checkedAt).getTime() + days * DAY_MS).toISOString(),
        resolvedAt: null,
        resolvedAnalysisId: null,
      });
    }
  }
  return { drops: [...created, ...updated], created };
}

/** Open drops past their fix-by date at `now`. */
export function isOverdue(drop: DropRecord, now: Date): boolean {
  return drop.resolvedAt === null && new Date(drop.fixBy).getTime() < now.getTime();
}
