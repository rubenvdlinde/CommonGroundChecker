import { describe, expect, it } from "vitest";
import { ASPECT_MODEL, resolveCategory } from "@/lib/aspects";
import { CRITERION_VERSIONS, RESULT_CATEGORY_BY_ID, RESULT_ORDER_BY_ID } from "@/lib/criteria";
import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID } from "@/lib/checkers/config";
import {
  CRITERION_DOCS,
  SOURCE_DOCS,
  findCriterionDoc,
  orderedCriterionDocs,
  resolveCriterionDoc,
} from "@/lib/criterionDocs";
import { PROFILE_FIELDS } from "@/lib/publiccodeProfile";

/** Criteria that live in open changes to the checker, not in this version. */
const PLANNED_IDS: string[] = [];

function modelIds(): string[] {
  return ASPECT_MODEL.flatMap((category) =>
    category.aspects.flatMap((aspect) =>
      "checkId" in aspect.source ? [aspect.source.checkId] : aspect.source.checkIds
    )
  );
}

function resolve(id: string) {
  const doc = findCriterionDoc(id);
  if (!doc) throw new Error(`No doc for ${id}`);
  return resolveCriterionDoc(doc, DEFAULT_CRITERION_CONFIG_BY_CHECK_ID);
}

describe("criterion docs coverage", () => {
  it("has a page for every criterion the checker measures", () => {
    for (const id of RESULT_ORDER_BY_ID) expect(findCriterionDoc(id), id).toBeDefined();
  });

  it("has a page for every criterion the aspect model names", () => {
    for (const id of modelIds()) expect(findCriterionDoc(id), id).toBeDefined();
  });

  it("uses every id once and nothing beyond the measured and the planned criteria", () => {
    const ids = CRITERION_DOCS.map((doc) => doc.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...RESULT_ORDER_BY_ID, ...PLANNED_IDS].sort());
  });

  it("carries its own category, aspect and level only for a criterion this version does not measure", () => {
    for (const doc of CRITERION_DOCS) {
      expect(doc.planned !== undefined, doc.id).toBe(!RESULT_ORDER_BY_ID.includes(doc.id));
    }
  });

  it("gives every planned criterion a category of the model and an aspect that agrees with the model", () => {
    for (const doc of CRITERION_DOCS.filter((candidate) => candidate.planned)) {
      const planned = doc.planned!;
      expect(resolveCategory(planned.category), doc.id).toBeDefined();
      const inModel = ASPECT_MODEL.flatMap((category) =>
        category.aspects
          .filter((aspect) =>
            "checkId" in aspect.source ? aspect.source.checkId === doc.id : aspect.source.checkIds.includes(doc.id)
          )
          .map((aspect) => ({ aspect: aspect.id, category: category.category }))
      );
      if (planned.aspect) {
        expect(inModel.map((entry) => entry.aspect), doc.id).toContain(planned.aspect);
      }
      for (const entry of inModel) expect(entry.category, doc.id).toBe(planned.category);
    }
  });

  it("names only fields of the publiccode.yml profile", () => {
    const fieldIds = PROFILE_FIELDS.map((field) => field.id);
    for (const doc of CRITERION_DOCS) {
      for (const field of doc.publiccodeFields ?? []) expect(fieldIds, `${doc.id}: ${field}`).toContain(field);
    }
  });

  it("names a tool and at least one step for every criterion", () => {
    for (const doc of CRITERION_DOCS) {
      expect(resolve(doc.id).measuredWith, doc.id).toBeTruthy();
      expect(doc.howToPass.length, doc.id).toBeGreaterThan(0);
    }
  });

  it("writes no em-dashes or double dashes", () => {
    const text = [
      ...Object.values(SOURCE_DOCS).flatMap((source) => [source.label, source.explanation]),
      ...CRITERION_DOCS.flatMap((doc) => [doc.title, doc.what, doc.why, doc.sourceNote ?? "", doc.tool ?? "", ...doc.howToPass]),
    ];
    for (const line of text) expect(line).not.toMatch(/—|--/);
  });
});

describe("resolveCriterionDoc", () => {
  it("takes level, category and version of a measured criterion from this version of the checker", () => {
    for (const id of RESULT_ORDER_BY_ID) {
      const doc = resolve(id);
      expect(doc.measured, id).toBe(true);
      expect(doc.level, id).toBe(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID[id].requirementLevel);
      expect(doc.category, id).toBe(RESULT_CATEGORY_BY_ID[id]);
      expect(doc.introducedIn, id).toBe(CRITERION_VERSIONS[id].introducedIn);
    }
  });

  it("resolves a tool criterion to this version's category name", () => {
    const doc = resolve("testcoderatio");
    expect(doc.measured).toBe(true);
    expect(doc.category).toBe(resolveCategory("Maintainability"));
    expect(doc.level).toBe("recommended");
    expect(doc.aspects.map((aspect) => aspect.id)).toEqual(["testing"]);
  });

  it("gives the transition date of a mandatory criterion that is not mandatory yet", () => {
    expect(resolve("artifacthub").mandatoryFrom).toBe(CRITERION_VERSIONS.artifacthub.mandatoryFrom);
    expect(resolve("license").mandatoryFrom).toBeNull();
  });

  it("does not count an informative criterion", () => {
    expect(resolve("standards").counted).toBe(false);
    expect(resolve("license").counted).toBe(true);
  });

  it("links the aspects to their section in the rating guide", () => {
    expect(resolve("secretscanning").aspects).toEqual([
      { id: "secrets", title: "Secrets", modelCategory: "Security", href: "/docs/security#secrets" },
    ]);
  });

  it("links the publiccode.yml fields to the profile", () => {
    expect(resolve("maintenance").fields).toEqual([
      { id: "maintenance", keys: "maintenance", href: "/docs/publiccode-profile#maintenance" },
    ]);
  });

  it("explains the shared component definition on the maintainability and coupling pages only", () => {
    const withComponents = CRITERION_DOCS.filter((doc) => doc.components).map((doc) => doc.id);

    expect(withComponents).toEqual(["maintainability", "coupling"]);
    expect(resolve("coupling").components).toBe(resolve("maintainability").components);
    expect(resolve("coupling").components).toContain("sigrid.components.yaml");
    expect(resolve("coupling").components).toContain("tools/sig/area-order.json");
  });

  it("orders the measured criteria as the report does, then the planned ones", () => {
    const ids = orderedCriterionDocs().map((doc) => doc.id);
    expect(ids.slice(0, RESULT_ORDER_BY_ID.length)).toEqual(RESULT_ORDER_BY_ID);
  });
});
