import type { CheckStatus, StarRating } from "./types";

function clampStars(value: number): StarRating {
  return Math.min(5, Math.max(1, value)) as StarRating;
}

/** Rounds a continuous 0.5 to 5.5 rating to whole stars; x.5 rounds up. */
export function ratingToStars(rating: number): StarRating {
  return clampStars(Math.floor(rating + 0.5));
}

/** Stars for a criterion that has no scale of its own. */
export function statusToStars(status: CheckStatus): StarRating {
  if (status === "pass") return 5;
  if (status === "fail") return 1;
  return 3;
}

/** Maps the 0-100 compliance score onto 1 to 5 stars in bands of 25 points. */
export function scoreToStars(score: number): StarRating {
  return clampStars(Math.round(score / 25) + 1);
}

export function formatStars(stars: StarRating): string {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}
