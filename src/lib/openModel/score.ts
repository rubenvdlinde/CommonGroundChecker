import type { StarLevel, StarRating } from "../types";
import { STAR_LEVELS } from "../types";
import thresholds from "./thresholds-2026-11-18.2.json";

/** LOC per metric value, for example `{ "12": 340 }`: 340 lines in units of 12 lines. */
export type Histogram = Record<string, number>;

/**
 * The raw open-track measures of one repository. Each field is optional, so a
 * property that was not measured is reported as such.
 */
export interface OpenTrackInput {
  /** Risk-profile properties (unit size, complexity, interfacing, later module coupling): LOC per metric value */
  histograms?: Record<string, Histogram>;
  /** Share properties (duplication): a share from 0 to 1 */
  shares?: Record<string, number>;
}

export interface RiskProfileThreshold {
  kind: "risk-profile";
  metric: string;
  /** A unit above bounds[0] is moderate risk, above bounds[1] high, above bounds[2] very high */
  bounds: number[];
  /** Per star level, the maximum share of LOC above each bound */
  stars: Record<string, number[]>;
}

export interface ShareThreshold {
  /** "share": at most the limit; "share-min": at least the limit, where a higher share is better */
  kind: "share" | "share-min";
  metric: string;
  /** Per star level, the maximum share (the minimum for "share-min") */
  stars: Record<string, number>;
}

export interface OpenTrackThresholds {
  version: string;
  properties: Record<string, RiskProfileThreshold | ShareThreshold>;
  not_calibrated?: Record<string, string>;
  benchmark: { repositories: number; list: string };
  tools: Record<string, unknown>;
}

export interface PropertyScore {
  property: string;
  /** Null when the property was not measured or has no thresholds */
  stars: StarRating | null;
  /** Why there are no stars */
  reason?: string;
  /** Risk profile: the share of LOC above each bound */
  shares?: number[];
  bounds?: number[];
  /** Share property: the measured share */
  share?: number;
  /** Share property: the limits are minimums, a higher share is better */
  atLeast?: boolean;
  /** The limits per star level, as in the thresholds file */
  limits?: Partial<Record<StarLevel, number | number[]>>;
}

export interface OpenTrackScore {
  version: string;
  properties: PropertyScore[];
  /** Mean of the rated properties' stars, or null when none is rated */
  rating: number | null;
}

/** The thresholds the checker rates with: the newest published file. */
export const OPEN_TRACK_THRESHOLDS = thresholds as unknown as OpenTrackThresholds;

/** Properties rated on the open track, in display order. */
export const OPEN_TRACK_PROPERTIES = [
  "unit_size",
  "unit_complexity",
  "unit_interfacing",
  "duplication",
  "module_coupling",
  "component_independence",
  "component_entanglement",
] as const;

/** The share of LOC strictly above each bound. */
export function riskProfile(histogram: Histogram, bounds: number[]): number[] | null {
  const entries = Object.entries(histogram).map(([value, loc]) => [Number(value), loc] as const);
  const total = entries.reduce((sum, [, loc]) => sum + loc, 0);
  if (total <= 0) return null;
  return bounds.map((bound) => entries.reduce((sum, [value, loc]) => (value > bound ? sum + loc : sum), 0) / total);
}

function limitsOf<T>(stars: Record<string, T>): Partial<Record<StarLevel, T>> {
  const limits: Partial<Record<StarLevel, T>> = {};
  for (const level of STAR_LEVELS) {
    if (stars[String(level)] !== undefined) limits[level] = stars[String(level)];
  }
  return limits;
}

/** The strictest level whose limit a share stays within, else 1. */
function levelOf(share: number, limitAt: (level: StarLevel) => number | undefined): StarRating {
  return STAR_LEVELS.find((level) => share <= (limitAt(level) ?? -Infinity)) ?? 1;
}

function scoreProperty(property: string, input: OpenTrackInput, thresholds: OpenTrackThresholds): PropertyScore {
  const threshold = thresholds.properties[property];
  if (!threshold) {
    return {
      property,
      stars: null,
      reason: `not calibrated: ${thresholds.not_calibrated?.[property] ?? "no thresholds in this version"}`,
    };
  }
  if (threshold.kind !== "risk-profile") {
    const share = input.shares?.[property];
    if (typeof share !== "number" || !Number.isFinite(share)) return { property, stars: null, reason: "not measured" };
    const limits = limitsOf(threshold.stars);
    if (threshold.kind === "share-min") {
      const level = STAR_LEVELS.find((candidate) => share >= (limits[candidate] ?? Infinity)) ?? 1;
      return { property, share, limits, atLeast: true, stars: level };
    }
    return { property, share, limits, stars: levelOf(share, (level) => limits[level]) };
  }
  const histogram = input.histograms?.[property];
  const shares = histogram ? riskProfile(histogram, threshold.bounds) : null;
  if (!shares) return { property, stars: null, reason: "not measured" };
  const limits = limitsOf(threshold.stars);
  return {
    property,
    shares,
    bounds: threshold.bounds,
    limits,
    // Alves, Correia and Visser 2011, section III-B1: the lowest of the levels per share.
    stars: Math.min(...shares.map((share, index) => levelOf(share, (level) => limits[level]?.[index]))) as StarRating,
  };
}

/** Rates raw open-track measures per property against published open-track thresholds. */
export function scoreOpenTrack(
  input: OpenTrackInput,
  thresholds: OpenTrackThresholds = OPEN_TRACK_THRESHOLDS
): OpenTrackScore {
  const properties = OPEN_TRACK_PROPERTIES.map((property) => scoreProperty(property, input, thresholds));
  const rated = properties.flatMap((score) => (score.stars === null ? [] : [score.stars]));
  return {
    version: thresholds.version,
    properties,
    rating: rated.length > 0 ? rated.reduce((sum, stars) => sum + stars, 0) / rated.length : null,
  };
}
