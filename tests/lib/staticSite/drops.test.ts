import { describe, expect, it } from "vitest";
import { detectDrops, isOverdue, ratingStars, snapshotOf, updateDrops, type ScannedAnalysis } from "@/lib/staticSite/drops";

const pass = { status: "pass", title: "Licence", requirementLevel: "mandatory" };

function analysis(id: string, checkedAt: string, overrides: Partial<ScannedAnalysis["snapshot"]> = {}, meta: Partial<ScannedAnalysis> = {}): ScannedAnalysis {
  return {
    id,
    checkedAt,
    scannedRefKind: "release",
    checklistVersion: "2026.1",
    snapshot: { criteria: { license: pass }, rating: 3.6, categoryRatings: { Security: 3.6 }, suitable: true, ...overrides },
    ...meta,
  };
}

describe("snapshotOf", () => {
  it("reads criteria, ratings and the verdict of a stored analysis", () => {
    expect(
      snapshotOf({
        results: [{ id: "license", status: "pass", title: "Licence", requirementLevel: "mandatory" }, { id: "license", status: "fail" }, null],
        rating: 3.2,
        categoryRatings: { Security: 2.9, Governance: null },
        endorsement: { passed: false, reasons: ["x"] },
      })
    ).toEqual({
      criteria: { license: pass },
      rating: 3.2,
      categoryRatings: { Security: 2.9, Governance: null },
      suitable: false,
    });
  });
});

describe("detectDrops", () => {
  it("finds a criterion from pass to fail, a lost star and a lost verdict", () => {
    const before = analysis("a", "2026-11-18T02:00:00Z").snapshot;
    const after = analysis("b", "2026-11-19T02:00:00Z", {
      criteria: { license: { ...pass, status: "fail" }, usage: { status: "fail", title: "Usage", requirementLevel: "informative" } },
      rating: 3.4,
      categoryRatings: { Security: 2.4 },
      suitable: false,
    }).snapshot;
    expect(detectDrops(before, after).map((drop) => `${drop.kind}:${drop.subject}:${drop.from}>${drop.to}`)).toEqual([
      "criterion:license:pass>fail",
      "rating:overall:4>3",
      "rating:Security:4>2",
      "verdict:suitable:suitable>not suitable",
    ]);
  });

  it("rounds x.5 up to whole stars", () => {
    expect([ratingStars(0.5), ratingStars(3.49), ratingStars(3.5), ratingStars(5.5)]).toEqual([1, 3, 4, 5]);
  });
});

describe("updateDrops", () => {
  const first = analysis("a", "2026-11-18T02:00:00Z");
  const dropped = analysis("b", "2026-11-19T02:00:00Z", { criteria: { license: { ...pass, status: "fail" } } });

  it("records a new drop with its fix-by date", () => {
    const { created } = updateDrops([], first, dropped);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: "criterion", subject: "license", fixTermDays: 30, previousAnalysisId: "a", resolvedAt: null });
    expect(created[0].fixBy).toBe("2026-12-19T02:00:00.000Z");
    expect(isOverdue(created[0], new Date("2026-12-20T00:00:00Z"))).toBe(true);
  });

  it("gives an open subject no second drop and resolves it on recovery", () => {
    const { drops } = updateDrops([], first, dropped);
    const again = updateDrops(drops, dropped, analysis("c", "2026-11-20T02:00:00Z", { criteria: { license: { ...pass, status: "fail" } } }));
    expect(again.created).toEqual([]);
    const recovered = updateDrops(again.drops, dropped, analysis("d", "2026-11-21T02:00:00Z"));
    expect(recovered.drops[0]).toMatchObject({ resolvedAt: "2026-11-21T02:00:00Z", resolvedAnalysisId: "d" });
  });

  it("starts a new baseline on another checklist version, another ref kind or without a version", () => {
    expect(updateDrops([], first, { ...dropped, checklistVersion: "2026.2" }).created).toEqual([]);
    expect(updateDrops([], first, { ...dropped, scannedRefKind: "default-branch" }).created).toEqual([]);
    expect(updateDrops([], { ...first, checklistVersion: null }, { ...dropped, checklistVersion: null }).created).toEqual([]);
    expect(updateDrops([], null, dropped).created).toEqual([]);
  });
});
