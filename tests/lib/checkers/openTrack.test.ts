import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkOpenTrack,
  mapOpenTrack,
  openTrackExtras,
  openTrackInput,
  rateOpenTrack,
  withOpenTrackExtras,
  type OpenTrackScriptMeasures,
} from "@/lib/checkers/openTrack";
import { OPEN_TRACK_THRESHOLDS } from "@/lib/openModel/score";
import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID } from "@/lib/checkers/config";
import { RESULT_CATEGORY_BY_ID, RESULT_ORDER_BY_ID } from "@/lib/criteria";

function benchmarkMeasures(slug: string): OpenTrackScriptMeasures {
  const file = path.join(process.cwd(), "scripts", "open-benchmark", "measures", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as OpenTrackScriptMeasures;
}

const openZaak = benchmarkMeasures("open-zaak__open-zaak");

describe("openTrackInput", () => {
  it("pools the languages of a repository, duplication included", () => {
    const input = openTrackInput({
      schema: 1,
      files: 2,
      tools: { lizard: "1.24.3", jscpd: "5.4.2" },
      languages: {
        php: {
          code_loc: 100,
          unit_loc: 30,
          unit_size: { "10": 20, "40": 10 },
          unit_complexity: { "1": 30 },
          unit_interfacing: { "0": 30 },
          duplication: { lines: 200, duplicated_lines: 20 },
        },
        vue: {
          code_loc: 50,
          unit_loc: 5,
          unit_size: { "10": 5 },
          unit_complexity: { "2": 5 },
          unit_interfacing: { "1": 5 },
          duplication: { lines: 100, duplicated_lines: 10 },
        },
      },
    });

    expect(input.histograms?.unit_size).toEqual({ "10": 25, "40": 10 });
    expect(input.histograms?.unit_complexity).toEqual({ "1": 30, "2": 5 });
    expect(input.shares).toEqual({ duplication: 0.1 });
  });

  it("leaves duplication out when it was not measured", () => {
    const withoutDuplication: OpenTrackScriptMeasures = {
      ...openZaak,
      languages: Object.fromEntries(
        Object.entries(openZaak.languages).map(([language, measures]) => [language, { ...measures, duplication: undefined }])
      ),
    };

    expect(openTrackInput(withoutDuplication).shares).toEqual({});
  });
});

describe("mapOpenTrack", () => {
  it("rates a real repository per property and as a whole, for information only", () => {
    const result = mapOpenTrack(openTrackInput(openZaak));

    expect(result).toMatchObject({ id: "opentrack", status: "info", starRating: 3, rating: 3 });
    expect(result.message).toContain("not a SIG rating");
    expect(result.evidence?.[0]).toMatch(/^Unit size: ★★★☆☆ 36\.0% \/ 22\.3% \/ 7\.9% of the code above \d+ \/ \d+ \/ \d+ lines$/);
    expect(result.evidence).toContain("Duplication: ★★★☆☆ 5.8% duplicated lines");
    expect(result.evidence).toContain("Module coupling: not measured");
    expect(result.evidence?.at(-1)).toContain(`derived from ${OPEN_TRACK_THRESHOLDS.benchmark.repositories} benchmark repositories`);
  });

  it("shows each bound against the limits of every star level", () => {
    const result = mapOpenTrack(openTrackInput(openZaak));
    const unitSize = result.measurements?.find((group) => group.id === "open-unit-size");
    const [bound] = (OPEN_TRACK_THRESHOLDS.properties.unit_size as { bounds: number[] }).bounds;

    expect(unitSize?.rows).toHaveLength(3);
    expect(unitSize?.rows[0]).toMatchObject({ label: `All languages, more than ${bound} lines`, value: "36.0%" });
    expect(Object.keys(unitSize?.rows[0].thresholds ?? {}).sort()).toEqual(["2", "3", "4", "5"]);
    expect(result.measurements?.find((group) => group.id === "open-duplication")?.rows).toHaveLength(1);
  });

  it("takes measures from other checks, such as duplication", () => {
    const own = openTrackInput(openZaak);
    const result = mapOpenTrack({ histograms: own.histograms, shares: { duplication: 0 } });

    expect(result.evidence).toContain("Duplication: ★★★★★ 0.0% duplicated lines");
  });

  it("reports when nothing could be rated", () => {
    const result = mapOpenTrack({});

    expect(result.status).toBe("info");
    expect(result.starRating).toBeUndefined();
    expect(result.evidence).toContain("Unit size: not measured");
  });
});

describe("checkOpenTrack", () => {
  it("reports without a cloned repository", async () => {
    const result = await checkOpenTrack(undefined);

    expect(result).toMatchObject({ id: "opentrack", status: "info" });
    expect(result.message).toContain("could not be cloned");
  });

  it("is informative, weighs nothing and is listed next to the estimate", () => {
    expect(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID.opentrack).toEqual({ weight: 0, requirementLevel: "informative" });
    expect(RESULT_CATEGORY_BY_ID.opentrack).toBe(RESULT_CATEGORY_BY_ID.maintainability);
    expect(RESULT_ORDER_BY_ID.indexOf("opentrack")).toBe(RESULT_ORDER_BY_ID.indexOf("maintainability") + 1);
  });
});

describe("openTrackExtras", () => {
  const duplicationResult = {
    id: "duplication",
    title: "Duplication, open track",
    description: "",
    status: "info" as const,
    message: "",
    evidence: [] as string[],
    openTrack: {
      duplication: { tool: "jscpd 5.4.2", percentage: 5.75, languages: { python: 5.76, javascript: null }, largestClones: [] },
    },
  };

  it("reads the duplication check's percentage as a share", () => {
    expect(openTrackExtras([duplicationResult]).shares?.duplication).toBeCloseTo(0.0575, 10);
  });

  it("ignores a duplication that was not measured, and results without open-track measures", () => {
    const notMeasured = { ...duplicationResult, openTrack: { duplication: { ...duplicationResult.openTrack.duplication, percentage: null } } };

    expect(openTrackExtras([notMeasured, { id: "license" }])).toEqual({ shares: {} });
  });

  it("rates the open-track result again with them", () => {
    const measurement = { input: openTrackInput(openZaak), skippedFiles: 0 };
    const results = withOpenTrackExtras([rateOpenTrack({ input: { histograms: {} }, skippedFiles: 0 }), duplicationResult], measurement);

    expect(results[0].evidence).toContain("Duplication: ★★★☆☆ 5.8% duplicated lines");
    expect(results[1]).toBe(duplicationResult);
  });
});

describe("openTrackExtras with coupling", () => {
  function language(loc: number, independence: number, violationDegree: number, fanInHistogram?: Record<string, number>) {
    return {
      measured: true,
      tool: "pdepend 3.0.0",
      modules: 3,
      edges: 2,
      loc,
      componentDefinition: "directories below lib/",
      components: 2,
      componentIndependence: independence,
      componentEntanglement: { violationDegree, density: 1, communicationLines: 1, violations: {} },
      moduleCoupling: {
        bounds: [10, 20, 50],
        riskProfile: { low: 1, moderate: 0, high: 0, veryHigh: 0 },
        above: [0, 0, 0],
        highestFanIn: [],
        ...(fanInHistogram ? { fanInHistogram } : {}),
      },
      cycles: { moduleCycles: 0, modulesInCycles: 0, locShareInCycles: 0, largestModuleCycle: 0, componentCycles: 0, largestComponentCycle: 0 },
    };
  }
  const coupling = (languages: Record<string, unknown>) => [{ id: "coupling", openTrack: { coupling: { version: 1, languages } } }];

  it("pools the coupling check's languages as the benchmark does", () => {
    const extra = openTrackExtras(
      coupling({ php: language(300, 0.9, 0.1, { "0": 200, "12": 100 }), javascript: language(100, 0.5, 0.3, { "0": 100 }) })
    );

    expect(extra.histograms?.module_coupling).toEqual({ "0": 300, "12": 100 });
    expect(extra.shares?.component_independence).toBeCloseTo(0.8, 10);
    expect(extra.shares?.component_entanglement).toBeCloseTo(0.15, 10);
  });

  it("rates no coupling when a language was not measured", () => {
    const extra = openTrackExtras(
      coupling({ php: language(300, 0.9, 0.1, { "0": 300 }), python: { measured: false, reason: "grimp failed", files: 3 } })
    );

    expect(extra).toEqual({ shares: {} });
  });

  it("rates independence and entanglement but not module coupling without a fan-in histogram", () => {
    const extra = openTrackExtras(coupling({ php: language(300, 0.9, 0.1) }));

    expect(extra.histograms).toBeUndefined();
    expect(extra.shares).toEqual({ component_independence: 0.9, component_entanglement: 0.1 });
  });
});

describe("the open track with every property", () => {
  it("rates Open Zaak on all seven properties with its benchmark coupling measures", () => {
    const file = path.join(process.cwd(), "scripts", "open-benchmark", "coupling", "open-zaak__open-zaak.json");
    const coupling = JSON.parse(readFileSync(file, "utf8"));
    const extra = openTrackExtras([{ openTrack: { coupling } }]);
    const result = rateOpenTrack({ input: openTrackInput(openZaak), skippedFiles: 0 }, extra);

    expect(result.message).toContain("the mean of 7 rated properties");
    expect(result.rating).toBeCloseTo(20 / 7, 10);
    expect(result.evidence).toContain("Component independence: ★★★☆☆ 81.4% of the code hidden from other components");
    expect(result.evidence).toContain("Component entanglement: ★★★☆☆ 0.048 violation degree");
    expect(result.evidence?.find((line) => line.startsWith("Module coupling"))).toMatch(/^Module coupling: ★★☆☆☆ /);
  });
});

describe("open-track description", () => {
  it("names every property the open track rates", () => {
    const result = rateOpenTrack({ input: openTrackInput(openZaak), skippedFiles: 0 });
    for (const property of [
      "unit size",
      "unit complexity",
      "unit interfacing",
      "duplication",
      "module coupling",
      "component independence",
      "component entanglement",
    ]) {
      expect(result.description.toLowerCase()).toContain(property);
    }
  });
});
