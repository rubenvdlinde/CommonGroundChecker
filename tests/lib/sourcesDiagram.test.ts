import { describe, expect, it } from "vitest";
import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID } from "@/lib/checkers/config";
import { CRITERION_DOCS, resolveCriterionDoc } from "@/lib/criterionDocs";
import {
  DIAGRAM_SOURCES,
  DIAGRAM_SOURCE_ORDER,
  criteriaMissingFromDiagram,
  criterionDiagramSources,
  diagramCriterionIds,
  sourcesDiagramData,
} from "@/lib/sourcesDiagram";
import { SFPC_CRITERIA, sfpcCriterionUrl, sfpcNotMeasuredList } from "@/lib/standardForPublicCode";

describe("criterion tools", () => {
  it("names the tool of every criterion", () => {
    for (const doc of CRITERION_DOCS) {
      const tool = resolveCriterionDoc(doc, DEFAULT_CRITERION_CONFIG_BY_CHECK_ID).measuredWith;
      expect(tool?.trim().length ?? 0, doc.id).toBeGreaterThan(0);
    }
  });
});

describe("Standard for Public Code mapping", () => {
  it("has the sixteen criteria of the standard, each with its page", () => {
    expect(SFPC_CRITERIA).toHaveLength(16);
    expect(new Set(SFPC_CRITERIA.map((criterion) => criterion.id)).size).toBe(16);
    expect(sfpcCriterionUrl("use-open-standards")).toBe("https://standard.publiccode.net/criteria/use-open-standards.html");
  });

  it("covers every criterion of the standard with a checker criterion, or says why not", () => {
    const covered = new Set(CRITERION_DOCS.flatMap((doc) => (doc.standardForPublicCode ? [doc.standardForPublicCode] : [])));
    for (const criterion of SFPC_CRITERIA) {
      expect(covered.has(criterion.id) !== Boolean(criterion.notMeasured), criterion.id).toBe(true);
    }
  });

  it("does not measure bundle policy, review of contributions, plain English and a coherent style", () => {
    const notMeasured = SFPC_CRITERIA.filter((criterion) => criterion.notMeasured).map((criterion) => criterion.id);
    for (const id of ["bundle-policy-and-source-code", "require-review-of-contributions", "use-plain-english", "use-a-coherent-style"]) {
      expect(notMeasured, id).toContain(id);
    }
    expect(sfpcNotMeasuredList()).toMatch(/^"Bundle policy and source code", .* and "Use a coherent style"$/);
  });
});

describe("sources diagram data", () => {
  it("places every criterion exactly once", () => {
    const ids = diagramCriterionIds();
    expect(criteriaMissingFromDiagram()).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(CRITERION_DOCS.map((doc) => doc.id));
    for (const id of ids) expect(known.has(id), id).toBe(true);
  });

  it("draws the five sources in order, each with the number of measures that follow from it", () => {
    const data = sourcesDiagramData();
    expect(data.sources.map((source) => source.id)).toEqual(DIAGRAM_SOURCE_ORDER);
    for (const source of data.sources) {
      const count = data.groups.flatMap((group) => group.measures).filter((measure) => measure.sources.includes(source.id)).length;
      expect(source.count, source.id).toBe(count);
      expect(source.count, source.id).toBeGreaterThan(0);
    }
    const fpc = data.sources.find((source) => source.id === "fpc")!;
    expect(fpc.count).toBe(CRITERION_DOCS.filter((doc) => doc.standardForPublicCode).length);
  });

  it("derives the sources of a measure from the criterion docs", () => {
    expect(criterionDiagramSources("changelog")).toEqual(["hugo", "fpc"]);
    expect(criterionDiagramSources("adrvalidator")).toEqual(["hugo", "alv", "fpc"]);
    expect(criterionDiagramSources("maintainability")).toEqual(["sig"]);
    expect(criterionDiagramSources("sonarqube")).toEqual(["own"]);
    expect(criterionDiagramSources("projecthealth")).toEqual(["own"]);
  });

  it("marks AI readiness and the information-only criteria as informative own additions", () => {
    const measures = sourcesDiagramData().groups.flatMap((group) => group.measures);
    const ai = sourcesDiagramData().groups.find((group) => group.id === "ai-readiness")!;
    expect(ai.measures).toHaveLength(6);
    for (const measure of ai.measures) {
      expect(measure.sources).toEqual(["own"]);
      expect(measure.informative).toBe(true);
    }
    expect(measures.find((measure) => measure.id === "maintainability")!.informative).toBe(false);
    expect(measures.find((measure) => measure.id === "sonarqube")!.informative).toBe(true);
    expect(measures.find((measure) => measure.id === "suitable")!.sources).toEqual(["alv"]);
  });

  it("links every criterion measure to its criterion page", () => {
    for (const group of sourcesDiagramData().groups) {
      for (const measure of group.measures) {
        if (diagramCriterionIds().includes(measure.id)) expect(measure.href).toBe(`/docs/criteria/${measure.id}`);
      }
    }
  });

  it("uses no dashes in its texts", () => {
    const data = sourcesDiagramData();
    const texts = [
      ...DIAGRAM_SOURCES.flatMap((source) => [source.name, source.text, ...(source.items ?? [])]),
      ...data.groups.flatMap((group) => [group.name, group.tool]),
    ];
    for (const text of texts) expect(text, text).not.toMatch(/[–—]|--/);
  });
});
