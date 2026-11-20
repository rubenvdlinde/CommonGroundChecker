import { describe, expect, it } from "vitest";
import { derivedStarRating, formatStars, minimumRatingFor, ratingToStars, scoreToStars, statusToStars } from "@/lib/stars";

describe("stars", () => {
  it.each([
    [0.5, 1],
    [1.49, 1],
    [1.5, 2],
    [3.5, 4],
    [5.5, 5],
  ])("rounds rating %s to %s stars", (rating, stars) => {
    expect(ratingToStars(rating)).toBe(stars);
  });

  it.each([1, 2, 3, 4, 5] as const)("starts %s stars at the lowest rating that rounds to it", (stars) => {
    expect(ratingToStars(minimumRatingFor(stars))).toBe(stars);
    expect(ratingToStars(minimumRatingFor(stars) - 0.01)).toBe(Math.max(1, stars - 1));
  });

  it.each([
    [0, 1],
    [12, 1],
    [13, 2],
    [50, 3],
    [80, 4],
    [88, 5],
    [100, 5],
  ])("maps score %s to %s stars", (score, stars) => {
    expect(scoreToStars(score)).toBe(stars);
  });

  it("derives stars from a status", () => {
    expect(statusToStars("pass")).toBe(5);
    expect(statusToStars("warn")).toBe(3);
    expect(statusToStars("info")).toBe(3);
    expect(statusToStars("fail")).toBe(1);
  });

  it("derives no stars for a result that was not measured", () => {
    expect(derivedStarRating({ status: "info" })).toBeUndefined();
    expect(derivedStarRating({ status: "info", starRating: 2 })).toBe(2);
    expect(derivedStarRating({ status: "pass" })).toBe(5);
    expect(derivedStarRating({ status: "warn" })).toBe(3);
    expect(derivedStarRating({ status: "fail", starRating: 4 })).toBe(4);
  });

  it("derives no stars for an informative criterion, unless it has its own scale", () => {
    expect(derivedStarRating({ status: "fail", requirementLevel: "informative" })).toBeUndefined();
    expect(derivedStarRating({ status: "pass", requirementLevel: "informative" })).toBeUndefined();
    expect(derivedStarRating({ status: "info", requirementLevel: "informative", starRating: 3 })).toBe(3);
    expect(derivedStarRating({ status: "fail", requirementLevel: "recommended" })).toBe(1);
  });

  it("formats filled and empty stars", () => {
    expect(formatStars(3)).toBe("★★★☆☆");
  });
});
