import { describe, expect, it } from "vitest";
import {
  computeEndorsement,
  computeRatings,
  criterionRating,
  documentCountRating,
  formatRating,
  hasStoredRatings,
  PASSING_MAINTAINABILITY_RATING,
  PASSING_MAINTAINABILITY_STARS,
  ratingsForStoredAnalysis,
  roundRating,
  type RatingConfig,
  type RatingInput,
} from "@/lib/ratings";
import { ratingToStars } from "@/lib/stars";
import { ASPECT_MODEL, resolveCategory, type CategoryAspects } from "@/lib/aspects";
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from "@/lib/criteria";
import type { RequirementLevel } from "@/lib/types";

function category(name: string): string {
  const resolved = resolveCategory(name);
  if (!resolved) throw new Error(`Category ${name} is not in CATEGORY_ORDER`);
  return resolved;
}

const GOVERNANCE = category("Governance");
const SECURITY = category("Security");
const ARCHITECTURE = category("Architecture");
const MAINTAINABILITY = category("Maintainability");
const DEPLOYMENT = category("Deployment & Operations");

type CriterionConfig = { weight: number; requirementLevel: RequirementLevel };

function config(criteria: Record<string, CriterionConfig> = {}, categoryWeights?: Record<string, number>): RatingConfig {
  return { criterionConfigByCheckId: criteria, categoryWeights };
}

function result(id: string, status: RatingInput["status"], extra: Partial<RatingInput> = {}): RatingInput {
  return { id, status, ...extra };
}

const mandatory: CriterionConfig = { weight: 1, requirementLevel: "mandatory" };
const SUBCHARACTERISTICS = { analysability: 2.68, modifiability: 3, testability: 4, modularity: null, reusability: 2 };

/** Only the given categories count towards the overall rating. */
function onlyCategories(...names: string[]): Record<string, number> {
  return Object.fromEntries(CATEGORY_ORDER.map((name) => [name, names.includes(name) ? 1 : 0]));
}

describe("criterionRating", () => {
  it("uses the continuous rating first", () => {
    expect(criterionRating(result("maintainability", "fail", { rating: 3.4, starRating: 2 }))).toBe(3.4);
  });

  it("uses the stars when there is no continuous rating", () => {
    expect(criterionRating(result("maintainability", "fail", { starRating: 2 }))).toBe(2);
  });

  it("ignores a continuous rating outside 0.5 to 5.5", () => {
    expect(criterionRating(result("maintainability", "warn", { rating: 7, starRating: 4 }))).toBe(4);
    expect(criterionRating(result("maintainability", "warn", { rating: Number.NaN }))).toBe(3);
  });

  it.each([
    ["pass", 5.5],
    ["warn", 3],
    ["fail", 0.5],
  ] as const)("maps status %s to %s", (status, rating) => {
    expect(criterionRating(result("license", status))).toBe(rating);
  });

  it("keeps the stars of a criterion that has stars but no continuous rating", () => {
    expect(criterionRating(result("license", "pass", { starRating: 5 }))).toBe(5);
    expect(criterionRating(result("license", "fail", { starRating: 1 }))).toBe(1);
  });

  it("does not rate a result that was not measured", () => {
    expect(criterionRating(result("license", "info", { starRating: 3 }))).toBeNull();
  });
});

describe("documentCountRating", () => {
  it.each([
    [5, 5, 5.5],
    [4, 5, 4],
    [8, 10, 4],
    [79, 100, 3],
    [3, 5, 3],
    [59, 100, 2],
    [2, 5, 2],
    [39, 100, 1],
    [1, 5, 1],
    [0, 5, 1],
    [1, 1, 5.5],
    [99, 100, 4],
  ])("rates %s of %s as %s", (found, expected, rating) => {
    expect(documentCountRating(found, expected)).toBe(rating);
  });

  it("is null when nothing was measured", () => {
    expect(documentCountRating(0, 0)).toBeNull();
  });
});

describe("the aspect model", () => {
  const aspects = ASPECT_MODEL.flatMap((entry) => entry.aspects);

  it("has unique kebab-case aspect ids", () => {
    const ids = aspects.map((aspect) => aspect.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z]+(-[a-z]+)*$/.test(id))).toBe(true);
  });

  it("rates every category of CATEGORY_ORDER", () => {
    expect(ASPECT_MODEL.map((entry) => resolveCategory(entry.category)).sort()).toEqual([...CATEGORY_ORDER].sort());
  });

  it("maps Maintainability onto the category of this base", () => {
    const categories: readonly string[] = CATEGORY_ORDER;
    expect(resolveCategory("Maintainability")).toBe(
      categories.includes("Maintainability") ? "Maintainability" : "Software Quality"
    );
    expect(resolveCategory("Unknown")).toBeUndefined();
  });
});

describe("computeRatings", () => {
  it("lists every category and every aspect, unrated when nothing counts", () => {
    const ratings = computeRatings([], config());

    expect(Object.keys(ratings.categoryRatings)).toEqual(CATEGORY_ORDER);
    expect(Object.values(ratings.categoryRatings).every((rating) => rating === null)).toBe(true);
    expect(Object.keys(ratings.aspectRatings).sort()).toEqual(
      ASPECT_MODEL.flatMap((entry) => entry.aspects.map((aspect) => aspect.id)).sort()
    );
    expect(Object.values(ratings.aspectRatings).every((aspect) => aspect.rating === null)).toBe(true);
    expect(ratings.rating).toBeNull();
  });

  describe("aspects a check rates itself", () => {
    it("takes the maintainability sub-characteristics", () => {
      const ratings = computeRatings(
        [result("maintainability", "warn", { rating: 2.9, aspectRatings: SUBCHARACTERISTICS })],
        config()
      );

      expect(ratings.aspectRatings.analysability).toEqual({ rating: 2.7 });
      expect(ratings.aspectRatings.testability).toEqual({ rating: 4 });
      expect(ratings.aspectRatings.modularity).toEqual({ rating: null });
      // (2.68 + 3 + 4 + 2) / 4 = 2.92; modularity and testing are unrated
      expect(ratings.categoryRatings[MAINTAINABILITY]).toBe(2.9);
    });

    it("is null when the maintainability check did not run or rate", () => {
      expect(computeRatings([], config()).aspectRatings.analysability.rating).toBeNull();
      expect(
        computeRatings([result("maintainability", "warn")], config()).aspectRatings.analysability.rating
      ).toBeNull();
      expect(
        computeRatings([result("maintainability", "info", { aspectRatings: SUBCHARACTERISTICS })], config())
          .aspectRatings.analysability.rating
      ).toBeNull();
    });

    it("is null when the check does not count", () => {
      const results = [result("maintainability", "warn", { aspectRatings: SUBCHARACTERISTICS })];

      expect(
        computeRatings(results, config({ maintainability: { weight: 0, requirementLevel: "recommended" } }))
          .aspectRatings.analysability.rating
      ).toBeNull();
      expect(
        computeRatings(results, config({ maintainability: { weight: 1, requirementLevel: "informative" } }))
          .aspectRatings.analysability.rating
      ).toBeNull();
    });

    it("ignores an aspect rating outside 0.5 to 5.5", () => {
      const ratings = computeRatings(
        [result("maintainability", "warn", { aspectRatings: { analysability: 7 } })],
        config()
      );

      expect(ratings.aspectRatings.analysability.rating).toBeNull();
    });

    it("maps the Open Source Health properties onto the dependency aspects", () => {
      const ratings = computeRatings(
        [
          result("opensourcehealth", "warn", {
            aspectRatings: { vulnerabilities: 2, freshness: 3.5, activity: 4, licence: 5, management: 1 },
          }),
        ],
        config()
      );

      expect(ratings.aspectRatings.vulnerabilities.rating).toBe(2);
      expect(ratings.aspectRatings["dependency-freshness"].rating).toBe(3.5);
      expect(ratings.aspectRatings["dependency-activity"].rating).toBe(4);
      expect(ratings.aspectRatings["dependency-licences"].rating).toBe(5);
      expect(ratings.aspectRatings["dependency-management"].rating).toBe(1);
      expect(ratings.categoryRatings[SECURITY]).toBe(3.1);
    });
  });

  describe("aspects rated from criteria", () => {
    it("takes the weighted mean of the criterion ratings", () => {
      const ratings = computeRatings(
        [result("tests", "pass"), result("coverage", "fail")],
        config({ tests: mandatory, coverage: { weight: 0.5, requirementLevel: "mandatory" } })
      );

      // (5.5 * 1 + 0.5 * 0.5) / 1.5 = 3.83
      expect(ratings.aspectRatings.testing).toEqual({ rating: 3.8 });
    });

    it("uses the test code ratio when present and the rest when absent", () => {
      const withRatio = computeRatings(
        [result("tests", "pass"), result("coverage", "fail"), result("testcoderatio", "pass", { rating: 3 })],
        config()
      );
      const withoutRatio = computeRatings([result("tests", "pass"), result("coverage", "fail")], config());

      expect(withRatio.aspectRatings.testing.rating).toBe(3);
      expect(withoutRatio.aspectRatings.testing.rating).toBe(3);
    });

    it("leaves out informative criteria, weight 0 and results that were not measured", () => {
      const ratings = computeRatings(
        [
          result("license", "pass"),
          result("eupllicense", "fail", { requirementLevel: "informative" }),
          result("licenceconsistency", "fail"),
          result("spdxheaders", "info"),
        ],
        config({ license: mandatory, licenceconsistency: { weight: 0, requirementLevel: "mandatory" } })
      );

      expect(ratings.aspectRatings.licensing.rating).toBe(5.5);
    });

    it("leaves out criteria the config makes informative", () => {
      const ratings = computeRatings(
        [result("license", "pass"), result("eupllicense", "fail")],
        config({ license: mandatory, eupllicense: { weight: 1, requirementLevel: "informative" } })
      );

      expect(ratings.aspectRatings.licensing.rating).toBe(5.5);
    });

    it("counts a criterion missing from the config with weight 1", () => {
      const ratings = computeRatings([result("license", "pass"), result("eupllicense", "fail")], config());

      expect(ratings.aspectRatings.licensing.rating).toBe(3);
    });

    it("rates a passing and a failing criterion at the ends of the scale", () => {
      expect(computeRatings([result("license", "pass")], config()).aspectRatings.licensing.rating).toBe(5.5);
      expect(computeRatings([result("license", "fail")], config()).aspectRatings.licensing.rating).toBe(0.5);
    });

    it("is null when none of its criteria count", () => {
      const ratings = computeRatings([result("secretscanning", "info")], config());

      expect(ratings.aspectRatings.secrets.rating).toBeNull();
    });

    it("counts a criterion where the model places it", () => {
      const ratings = computeRatings([result("sbom", "fail")], config());

      expect(ratings.aspectRatings["supply-chain"].rating).toBe(0.5);
      expect(ratings.categoryRatings[SECURITY]).toBe(0.5);
      expect(ratings.categoryRatings[MAINTAINABILITY]).toBeNull();
    });

    it("ignores criteria the model does not place", () => {
      const ratings = computeRatings([result("complexity", "fail"), result("unknown-check", "fail")], config());

      expect(ratings.rating).toBeNull();
    });
  });

  describe("document-count aspects", () => {
    it("rates the share of passing documents and reports the count", () => {
      const ratings = computeRatings(
        [
          result("documentation", "pass"),
          result("contributing", "pass"),
          result("codeofconduct", "pass"),
          result("security", "pass"),
          result("changelog", "warn"),
        ],
        config()
      );

      expect(ratings.aspectRatings["community-documents"]).toEqual({ rating: 4, found: 4, expected: 5 });
    });

    it("counts only the inputs that were measured and count", () => {
      const ratings = computeRatings(
        [
          result("documentation", "pass"),
          result("contributing", "pass"),
          result("codeofconduct", "info"),
          result("security", "fail", { requirementLevel: "informative" }),
          result("changelog", "fail"),
        ],
        config({ changelog: { weight: 0, requirementLevel: "recommended" } })
      );

      expect(ratings.aspectRatings["community-documents"]).toEqual({ rating: 5.5, found: 2, expected: 2 });
    });

    it("rates containerisation by its documents", () => {
      const ratings = computeRatings(
        [result("docker", "pass"), result("dockerimage", "fail"), result("helmchart", "pass")],
        config()
      );

      // 2 of 3 = 67%
      expect(ratings.aspectRatings.containerisation).toEqual({ rating: 3, found: 2, expected: 3 });
      expect(ratings.categoryRatings[DEPLOYMENT]).toBe(3);
    });

    it("is null with nothing measured", () => {
      expect(computeRatings([], config()).aspectRatings.containerisation).toEqual({
        rating: null,
        found: 0,
        expected: 0,
      });
    });
  });

  describe("categories", () => {
    it("take the plain mean of their rated aspects", () => {
      const ratings = computeRatings(
        [
          result("license", "pass"),
          result("eupllicense", "fail"),
          result("spdxheaders", "fail"),
          result("copyrightowner", "pass"),
        ],
        config()
      );

      // Licensing (5.5 + 0.5 + 0.5) / 3 = 2.17, ownership 5.5; (2.17 + 5.5) / 2 = 3.83
      expect(ratings.aspectRatings.licensing.rating).toBe(2.2);
      expect(ratings.categoryRatings[GOVERNANCE]).toBe(3.8);
    });

    it("show layering without counting it", () => {
      const ratings = computeRatings([result("openapi", "pass"), result("fivelayer", "fail")], config());

      expect(ratings.aspectRatings.layering.rating).toBe(0.5);
      expect(ratings.categoryRatings[ARCHITECTURE]).toBe(5.5);
    });

    it("are null when only aspects with weight 0 are rated", () => {
      const ratings = computeRatings([result("fivelayer", "pass")], config());

      expect(ratings.aspectRatings.layering.rating).toBe(5.5);
      expect(ratings.categoryRatings[ARCHITECTURE]).toBeNull();
      expect(ratings.rating).toBeNull();
    });

    it("are left out when the model names a category this base does not have", () => {
      const model: CategoryAspects[] = [
        { category: "Usability", aspects: [{ id: "help", title: "Help", source: { type: "criteria", checkIds: ["license"] } }] },
      ];
      const ratings = computeRatings([result("license", "pass")], config(), model);

      expect(ratings.aspectRatings.help).toBeUndefined();
      expect(ratings.rating).toBeNull();
    });
  });

  describe("the overall rating", () => {
    const results = [result("license", "pass"), result("owaspsecurecoding", "fail")];

    it("is the weighted mean of the categories", () => {
      const ratings = computeRatings(results, config({}, { ...onlyCategories(), [GOVERNANCE]: 0.75, [SECURITY]: 0.25 }));

      // (5.5 * 0.75 + 0.5 * 0.25) / 1 = 4.25
      expect(ratings.rating).toBe(4.3);
    });

    it("falls back to the default category weights", () => {
      const ratings = computeRatings(results, config());

      const governance = CATEGORY_WEIGHTS[GOVERNANCE as keyof typeof CATEGORY_WEIGHTS];
      const security = CATEGORY_WEIGHTS[SECURITY as keyof typeof CATEGORY_WEIGHTS];
      expect(ratings.rating).toBe(roundRating((5.5 * governance + 0.5 * security) / (governance + security)));
    });

    it("leaves out categories with weight 0", () => {
      const ratings = computeRatings(results, config({}, onlyCategories(SECURITY)));

      expect(ratings.categoryRatings[GOVERNANCE]).toBe(5.5);
      expect(ratings.rating).toBe(0.5);
    });

    it("is null when every rated category has weight 0", () => {
      expect(computeRatings(results, config({}, onlyCategories())).rating).toBeNull();
    });

    it("is computed from the unrounded category ratings", () => {
      const ratings = computeRatings(
        [
          result("license", "pass"),
          result("eupllicense", "fail"),
          result("spdxheaders", "fail"),
          result("owaspsecurecoding", "warn", { rating: 2.33 }),
        ],
        config({}, onlyCategories(GOVERNANCE, SECURITY))
      );

      // Governance 2.1666..., Security 2.33; the mean 2.2483... rounds to 2.2,
      // where the rounded ratings (2.2 + 2.3) / 2 = 2.25 would round to 2.3.
      expect(ratings.categoryRatings[GOVERNANCE]).toBe(2.2);
      expect(ratings.categoryRatings[SECURITY]).toBe(2.3);
      expect(ratings.rating).toBe(2.2);
    });
  });
});

describe("computeEndorsement", () => {
  const maintainable = result("maintainability", "pass", { rating: 4.4, starRating: 4 });

  it("passes without failing mandatory criteria and a rating of at least 2.5", () => {
    expect(computeEndorsement([result("license", "pass", { requirementLevel: "mandatory" }), maintainable], 2.5, config())).toEqual({
      passed: true,
      reasons: [],
    });
  });

  it("does not pass when a mandatory criterion fails", () => {
    const endorsement = computeEndorsement(
      [
        result("license", "fail", { requirementLevel: "mandatory", title: "Open source licence" }),
        result("changelog", "fail", { requirementLevel: "recommended", title: "Changelog" }),
        result("publiccode", "fail", { title: "publiccode.yml" }),
        maintainable,
      ],
      4,
      config({ publiccode: mandatory })
    );

    expect(endorsement).toEqual({
      passed: false,
      reasons: ["Mandatory criterion fails: Open source licence", "Mandatory criterion fails: publiccode.yml"],
    });
  });

  it("does not pass with a rating below 2.5", () => {
    expect(computeEndorsement([maintainable], 2.4, config())).toEqual({ passed: false, reasons: ["Overall rating below 2.5"] });
  });

  it("does not pass without a rating", () => {
    expect(computeEndorsement([maintainable], null, config())).toEqual({ passed: false, reasons: ["No overall rating"] });
  });

  it("lists every reason", () => {
    const endorsement = computeEndorsement([result("tests", "fail", { requirementLevel: "mandatory" }), maintainable], 1.2, config());

    expect(endorsement.reasons).toEqual(["Mandatory criterion fails: tests", "Overall rating below 2.5"]);
  });

  it("is suitable when the component has a valid maintenance contract", () => {
    expect(computeEndorsement([result("maintenance", "pass"), maintainable], 4, config())).toEqual({ passed: true, reasons: [] });
  });

  it("is not yet suitable without a valid maintenance contract, and gives the criterion's reason", () => {
    const message = "No valid maintenance contract: Maykin has no end date (until).";

    expect(computeEndorsement([result("maintenance", "fail", { message }), maintainable], 4, config())).toEqual({
      passed: false,
      reasons: [message],
    });
  });

  it("falls back to a general reason for a failing maintenance criterion without a message", () => {
    expect(computeEndorsement([result("maintenance", "fail"), maintainable], 4, config()).reasons).toEqual([
      "No valid maintenance contract",
    ]);
  });

  it("is not yet suitable when the maintenance contract could not be checked", () => {
    expect(computeEndorsement([result("maintenance", "warn"), maintainable], 4, config())).toEqual({
      passed: false,
      reasons: ["Maintenance contract not checked"],
    });
  });

  it("names a mandatory maintenance criterion that fails once", () => {
    const endorsement = computeEndorsement(
      [result("maintenance", "fail", { title: "Maintenance contract" }), maintainable],
      4,
      config({ maintenance: mandatory })
    );

    expect(endorsement.reasons).toEqual(["Mandatory criterion fails: Maintenance contract"]);
  });

  it("does not judge maintenance for a scan made before the criterion existed", () => {
    expect(computeEndorsement([result("license", "pass"), maintainable], 4, config()).passed).toBe(true);
  });

  it("passes with a mandatory criterion that warns", () => {
    expect(computeEndorsement([result("tests", "warn", { requirementLevel: "mandatory" }), maintainable], 3, config()).passed).toBe(true);
  });

  it("passes at a maintainability of exactly 3.5, where 4 stars start", () => {
    expect(PASSING_MAINTAINABILITY_RATING).toBe(3.5);
    expect(ratingToStars(PASSING_MAINTAINABILITY_RATING)).toBe(PASSING_MAINTAINABILITY_STARS);
    expect(computeEndorsement([result("maintainability", "pass", { rating: 3.5 })], 4, config())).toEqual({
      passed: true,
      reasons: [],
    });
  });

  it("does not pass at a maintainability of 3.49, and gives the measured value", () => {
    expect(ratingToStars(3.49)).toBe(3);
    expect(computeEndorsement([result("maintainability", "warn", { rating: 3.49 })], 4, config())).toEqual({
      passed: false,
      reasons: ["Maintainability below 4 stars (3.49)"],
    });
  });

  it("does not pass when the scan has no maintainability result", () => {
    expect(computeEndorsement([result("license", "pass")], 4, config())).toEqual({
      passed: false,
      reasons: ["Maintainability not measured"],
    });
  });

  it("does not pass when the maintainability could not be rated", () => {
    for (const unrated of [
      result("maintainability", "warn", { message: "No source files in a supported language" }),
      result("maintainability", "info"),
      result("maintainability", "warn", { rating: Number.NaN }),
    ]) {
      expect(computeEndorsement([unrated], 4, config()).reasons).toEqual(["Maintainability not measured"]);
    }
  });

  it("uses the maintainability stars of a stored result without a continuous rating", () => {
    expect(computeEndorsement([result("maintainability", "pass", { starRating: 4 })], 4, config()).passed).toBe(true);
    expect(computeEndorsement([result("maintainability", "warn", { starRating: 3 })], 4, config()).reasons).toEqual([
      "Maintainability below 4 stars (3.00)",
    ]);
  });

  it("lists a low maintainability together with the other reasons", () => {
    const endorsement = computeEndorsement(
      [
        result("license", "fail", { requirementLevel: "mandatory", title: "Open source licence" }),
        result("maintenance", "fail", { message: "No publiccode.yml was found, so there is no maintenance contract." }),
        result("maintainability", "fail", { rating: 2.68 }),
      ],
      2.1,
      config()
    );

    expect(endorsement).toEqual({
      passed: false,
      reasons: [
        "Mandatory criterion fails: Open source licence",
        "Overall rating below 2.5",
        "No publiccode.yml was found, so there is no maintenance contract.",
        "Maintainability below 4 stars (2.68)",
      ],
    });
  });
});

describe("roundRating", () => {
  it.each([
    [3.45, 3.5],
    [3.44, 3.4],
    [2.05, 2.1],
    [5.5, 5.5],
  ])("rounds %s to %s", (value, rounded) => {
    expect(roundRating(value)).toBe(rounded);
  });
});

describe("formatRating", () => {
  it("shows the stars and the number", () => {
    expect(formatRating(3.4)).toBe("★★★☆☆ 3.4");
    expect(formatRating(3.5)).toBe("★★★★☆ 3.5");
    expect(formatRating(5)).toBe("★★★★★ 5.0");
  });
});

describe("ratingsForStoredAnalysis", () => {
  const stored = {
    rating: 3.4,
    categoryRatings: { [GOVERNANCE]: 4.2, [SECURITY]: null },
    aspectRatings: { licensing: { rating: 4.2 }, "community-documents": { rating: 4, found: 4, expected: 5 } },
    endorsement: { passed: true, reasons: [] },
    results: [],
  };

  it("uses the stored ratings when present", () => {
    expect(hasStoredRatings(stored)).toBe(true);
    expect(ratingsForStoredAnalysis(stored, config())).toEqual({
      rating: 3.4,
      categoryRatings: { [GOVERNANCE]: 4.2, [SECURITY]: null },
      aspectRatings: { licensing: { rating: 4.2 }, "community-documents": { rating: 4, found: 4, expected: 5 } },
      endorsement: { passed: true, reasons: [] },
    });
  });

  it("gives an older analysis the reason its stored Maintained result gave", () => {
    const message = "publiccode.yml declares maintenance.type internal: there is no maintenance contract.";
    const older = { results: [{ id: "maintenance", title: "Maintained", status: "fail", message }] };

    expect(ratingsForStoredAnalysis(older, config()).endorsement.reasons).toContain(message);
  });

  it("keeps a stored null rating", () => {
    const unrated = { ...stored, rating: null, endorsement: { passed: false, reasons: ["No overall rating"] } };

    expect(hasStoredRatings(unrated)).toBe(true);
    expect(ratingsForStoredAnalysis(unrated, config()).rating).toBeNull();
  });

  it("recomputes when part of the ratings is missing", () => {
    expect(hasStoredRatings({ rating: 3.4, categoryRatings: {} })).toBe(false);
  });

  it("computes the ratings of an older analysis from its stored results", () => {
    const older = {
      results: [
        { id: "license", title: "Open source licence", status: "fail", requirementLevel: "mandatory", starRating: 1 },
        { id: "owaspsecurecoding", status: "pass" },
        { id: "maintainability", status: "warn", rating: 2.9, aspectRatings: { analysability: 2.6, modularity: "x" } },
        { id: "eupllicense", status: "pass", requirementLevel: "informative" },
        "not a result",
        { status: "fail" },
      ],
    };

    expect(hasStoredRatings(older)).toBe(false);
    const ratings = ratingsForStoredAnalysis(older, config());
    expect(ratings.categoryRatings[GOVERNANCE]).toBe(1);
    expect(ratings.categoryRatings[SECURITY]).toBe(5.5);
    expect(ratings.aspectRatings.analysability.rating).toBe(2.6);
    expect(ratings.aspectRatings.modularity.rating).toBeNull();
    expect(ratings.endorsement.reasons).toContain("Mandatory criterion fails: Open source licence");
  });

  it("is unrated without stored ratings or results", () => {
    const ratings = ratingsForStoredAnalysis({ results: "corrupt" }, config());

    expect(ratings.rating).toBeNull();
    expect(ratings.endorsement.passed).toBe(false);
  });
});
