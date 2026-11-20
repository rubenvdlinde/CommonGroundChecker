import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  SUBCHARACTERISTIC_PROPERTIES,
  checkMaintainability,
  maintainabilityMeasurements,
  mapMaintainabilityReport,
  type MaintainabilityReport,
} from "@/lib/checkers/maintainability";
import { RATING_DOCS } from "@/lib/ratingDocs";
import fixture from "../../fixtures/maintainability-report.json";
import openZaakFixture from "../../fixtures/maintainability-report-open-zaak.json";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn,
}));

const report = fixture as unknown as MaintainabilityReport;
const openZaak = openZaakFixture as unknown as MaintainabilityReport;

function withOverall(low: number, high: number): MaintainabilityReport {
  return { ...report, rating: { ...report.rating, overall: { range: [low, high] } } };
}

describe("mapMaintainabilityReport", () => {
  it("fails a real report rated about 2 stars and lists its rated properties", () => {
    const result = mapMaintainabilityReport(report);

    expect(result.id).toBe("maintainability");
    expect(result.status).toBe("fail");
    expect(result.starRating).toBe(2);
    expect(result.rating).toBeCloseTo(2.07, 10);
    expect(result.message).toContain("1.98 to 2.16");
    expect(result.evidence).toContain("Unit size: ★★☆☆☆ 1.5 (javascript 5.5, typescript 1.5)");
    expect(result.evidence?.some((line) => line.startsWith("Module coupling"))).toBe(false);
  });

  it("exposes the sub-characteristic ratings as aspect ratings", () => {
    const subcharacteristics = { analysability: 2.68, modifiability: 2.1, testability: 1.9, modularity: null, reusability: 2.4 };
    const result = mapMaintainabilityReport({ ...report, rating: { ...report.rating, subcharacteristics } });

    expect(result.aspectRatings).toEqual(subcharacteristics);
  });

  it("lists the three biggest levers with their effort", () => {
    const levers = mapMaintainabilityReport(report).evidence?.filter((line) => line.startsWith("Lever:"));

    expect(levers).toHaveLength(3);
    expect(levers?.[0]).toBe("Lever: unit complexity in typescript, about 188 lines to fix for half a star");
  });

  it("lists the combined JavaScript, TypeScript and Vue structure as its own language", () => {
    const result = mapMaintainabilityReport({
      ...report,
      rating: {
        ...report.rating,
        properties: {
          ...report.rating.properties,
          module_coupling: {
            rating: 5.11,
            languages: { php: { rating: 5.04, loc: 459167 }, "js/ts/vue": { rating: 5.43, loc: 92149 } },
          },
        },
      },
    });

    expect(result.evidence).toContain("Module coupling: ★★★★★ 5.1 (php 5.0, js/ts/vue 5.4)");
  });

  it("says why component independence was not rated for a language with a single component", () => {
    const warning =
      "all 12 modules fall into one component (src, directory rule), so component independence and entanglement are trivial; neither is rated.";
    const result = mapMaintainabilityReport({
      ...report,
      structure: { "js/ts/vue": { warning }, php: { warning: undefined }, python: null },
    });

    expect(result.evidence).toContain(`Not rated (js/ts/vue): ${warning}`);
    expect(result.evidence?.filter((line) => line.startsWith("Not rated"))).toHaveLength(1);
    expect(result.evidence?.some((line) => line.startsWith("Component independence"))).toBe(false);
  });

  it.each([
    [3.4, 3.6, "pass", 4],
    [2.6, 3.0, "warn", 3],
    [4.8, 5.4, "pass", 5],
    [0.5, 0.7, "fail", 1],
  ])("rates %s to %s as %s with %s stars", (low, high, status, stars) => {
    const result = mapMaintainabilityReport(withOverall(low, high));

    expect(result.status).toBe(status);
    expect(result.starRating).toBe(stars);
  });

  it("shows Simian's duplication cross-check next to the estimate's own figure", () => {
    const result = mapMaintainabilityReport({
      ...report,
      tools: { simian: "4.2.1" },
      languages: {
        php: { duplication: { share: 0.018 }, duplication_simian: { share: 0.0126 } },
        vue: { duplication: { share: 0.0267 }, duplication_simian: { notMeasured: "Simian has no support for this language" } },
      },
    });

    expect(result.evidence).toContain(
      "Duplication cross-check, Simian 4.2.1 strict against the estimate: php 1.3% against 1.8%, vue not measured (Simian has no support for this language) against 2.7%"
    );
  });

  it("leaves the cross-check out of a report without one", () => {
    const result = mapMaintainabilityReport(report);

    expect(result.evidence?.some((line) => line.startsWith("Duplication cross-check"))).toBe(false);
  });

  it("shows the rating under declared and under directory components when they differ", () => {
    const views = {
      used: "declared" as const,
      declared: {
        overall: [3.9, 4.1] as [number, number],
        modularity: 3.5,
        languages: {
          php: { definition: "sigrid.components.yaml components (10 declared)", components: 10, hidden_share: 0.67, violation_degree: 0.036 },
        },
      },
      directories: {
        overall: [3.1, 3.3] as [number, number],
        modularity: 1.2,
        languages: { php: { definition: "directory rule", components: 40, hidden_share: 0.2, violation_degree: 0.25 } },
      },
    };
    const evidence = mapMaintainabilityReport({ ...report, component_views: views }).evidence ?? [];

    expect(evidence).toContain(
      "Rating with declared functional components (sigrid.components.yaml components (10 declared)): 3.90 to 4.10, modularity 3.50 " +
        "(php 10 components, exposed 33.0%, violation degree 0.036). The score uses this one."
    );
    expect(evidence).toContain(
      "Rating with directory components: 3.10 to 3.30, modularity 1.20 (php 40 components, exposed 80.0%, violation degree 0.25)."
    );

    const same = { ...views, directories: { ...views.directories, overall: views.declared.overall, modularity: 3.5 } };
    expect(mapMaintainabilityReport({ ...report, component_views: same }).evidence).toContain(
      "Components: sigrid.components.yaml components (10 declared). Directory components give the same rating."
    );
  });

  it("lists the references against the declared area order", () => {
    const evidence =
      mapMaintainabilityReport({
        ...report,
        structure: {
          php: { area_order: { order: ["Kernel", "Core"], references: 12, top_sources: [{ file: "lib/A.php", references: 7 }] } },
        },
      }).evidence ?? [];

    expect(evidence).toContain(
      "References against the declared area order (php, Kernel < Core): 12; most from lib/A.php (7). Informative, not rated."
    );
  });

  it("warns when there is nothing to rate", () => {
    const result = mapMaintainabilityReport({ ...report, rating: { ...report.rating, overall: null } });

    expect(result.status).toBe("warn");
    expect(result.starRating).toBeUndefined();
    expect(result.rating).toBeUndefined();
  });
});

describe("maintainabilityMeasurements", () => {
  it("lists the share per language and bound of a real report against every star band", () => {
    const groups = maintainabilityMeasurements(openZaak);
    const unitSize = groups.find((group) => group.id === "unit-size");

    expect(groups.map((group) => group.id)).toEqual([
      "duplication",
      "unit-size",
      "unit-complexity",
      "unit-interfacing",
      "module-coupling",
      "component-independence",
      "component-entanglement",
    ]);
    expect(unitSize?.aspects).toEqual(["analysability", "reusability"]);
    expect(unitSize?.rows.find((row) => row.label === "Python, more than 30 lines")).toEqual({
      label: "Python, more than 30 lines",
      value: "34.7%",
      thresholds: { 5: "≤ 17.0%", 4: "≤ 24.2%", 3: "≤ 34.7%", 2: "≤ 49.0%" },
      stars: 2,
    });
    expect(unitSize?.rows.map((row) => row.label)).toEqual([
      "JavaScript, more than 15 lines",
      "JavaScript, more than 30 lines",
      "JavaScript, more than 60 lines",
      "Python, more than 15 lines",
      "Python, more than 30 lines",
      "Python, more than 60 lines",
    ]);
  });

  it("labels each bound the way the property is measured", () => {
    const labels = maintainabilityMeasurements(openZaak).flatMap((group) => group.rows.map((row) => row.label));

    expect(labels).toContain("Python, complexity above 25");
    expect(labels).toContain("Python, 3 or more parameters");
    expect(labels).toContain("Python, fan-in above 50");
  });

  it("shows duplication and the component properties as one row per language", () => {
    const groups = maintainabilityMeasurements(openZaak);
    const row = (id: string) => groups.find((group) => group.id === id)?.rows;

    expect(row("duplication")?.find((entry) => entry.label === "Python")).toEqual({
      label: "Python",
      value: "6.6%",
      thresholds: { 5: "≤ 3.5%", 4: "≤ 5.8%", 3: "≤ 11.6%", 2: "≤ 23.0%" },
      stars: 3,
    });
    expect(row("component-independence")).toEqual([
      {
        label: "Python",
        value: "81.1%",
        thresholds: { 5: "≥ 97.3%", 4: "≥ 94.5%" },
        stars: null,
        starsText: "below 4 stars",
      },
    ]);
    expect(row("component-entanglement")?.[0]).toMatchObject({ value: "0.2239", thresholds: { 5: "≤ 0.0375", 4: "≤ 0.075" } });
  });

  it("falls back to the 4-star limit of each row when the report has no bands", () => {
    const groups = maintainabilityMeasurements({ ...openZaak, bands: undefined });

    expect(groups.find((group) => group.id === "unit-size")?.rows[0].thresholds).toEqual({ 4: "≤ 48.0%" });
    expect(groups.find((group) => group.id === "component-independence")?.rows[0].thresholds).toEqual({ 4: "≥ 94.5%" });
  });

  it("puts the measurements on the check result, and none for a report without them", () => {
    expect(mapMaintainabilityReport(openZaak).measurements).toHaveLength(7);
    expect(mapMaintainabilityReport(report).measurements).toBeUndefined();
  });

  it("measures each sub-characteristic through the properties the rating guide names", () => {
    const docs = RATING_DOCS.find((category) => category.slug === "maintainability")?.aspects ?? [];

    for (const [subcharacteristic, properties] of Object.entries(SUBCHARACTERISTIC_PROPERTIES)) {
      const doc = docs.find((aspect) => aspect.id === subcharacteristic);
      expect(doc?.properties).toEqual(properties.map((property) => property.replace(/_/g, "-")));
    }
  });
});

describe("checkMaintainability", () => {
  it("warns without a cloned repository", async () => {
    const result = await checkMaintainability(undefined);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("could not be cloned");
  });

  it("runs estimate_report.py with the repository as its first argument", async () => {
    spawn.mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: vi.fn() });
      setImmediate(() => child.emit("close", 2, null));
      return child;
    });

    await checkMaintainability("/tmp/repo");

    const [command, args] = spawn.mock.calls[0];
    expect(command).toBe("python3");
    expect(args[0]).toMatch(/estimate_report\.py$/);
    expect(args.slice(1, 3)).toEqual(["/tmp/repo", "--json"]);
  });
});
