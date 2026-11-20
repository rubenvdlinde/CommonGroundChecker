import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPEN_TRACK_PROPERTIES,
  OPEN_TRACK_THRESHOLDS,
  riskProfile,
  scoreOpenTrack,
  type OpenTrackThresholds,
} from "@/lib/openModel/score";
import { openTrackExtras, openTrackInput, type OpenTrackScriptMeasures } from "@/lib/checkers/openTrack";

const BENCHMARK_DIR = path.join(process.cwd(), "scripts", "open-benchmark");

const thresholds: OpenTrackThresholds = {
  version: "test",
  benchmark: { repositories: 3, list: "benchmark.json" },
  tools: { lizard: "1.24.3" },
  properties: {
    unit_size: {
      kind: "risk-profile",
      metric: "unit LOC",
      bounds: [10, 20, 40],
      stars: { "5": [0.1, 0.05, 0], "4": [0.2, 0.1, 0.05], "3": [0.3, 0.2, 0.1], "2": [0.5, 0.4, 0.3] },
    },
    duplication: { kind: "share", metric: "jscpd", stars: { "5": 0.01, "4": 0.04, "3": 0.08, "2": 0.3 } },
    component_independence: {
      kind: "share-min",
      metric: "hidden code",
      stars: { "5": 0.9, "4": 0.7, "3": 0.5, "2": 0.2 },
    },
  },
  not_calibrated: { module_coupling: "no benchmark measures yet" },
};

function propertyOf(score: ReturnType<typeof scoreOpenTrack>, property: string) {
  return score.properties.find((entry) => entry.property === property)!;
}

describe("riskProfile", () => {
  it("returns the share of LOC strictly above each bound", () => {
    expect(riskProfile({ "5": 50, "10": 25, "15": 15, "50": 10 }, [10, 20, 40])).toEqual([0.25, 0.1, 0.1]);
  });

  it("returns null for an empty histogram", () => {
    expect(riskProfile({}, [10, 20, 40])).toBeNull();
  });
});

describe("scoreOpenTrack", () => {
  it("gives the highest level whose limits every share stays within, a limit itself included", () => {
    const score = scoreOpenTrack({ histograms: { unit_size: { "5": 80, "15": 20 } } }, thresholds);

    expect(propertyOf(score, "unit_size")).toMatchObject({ stars: 4, shares: [0.2, 0, 0], bounds: [10, 20, 40] });
  });

  it("gives 5 stars within the strictest limits and 1 star outside the loosest", () => {
    const best = scoreOpenTrack({ histograms: { unit_size: { "3": 100 } } }, thresholds);
    const worst = scoreOpenTrack({ histograms: { unit_size: { "3": 10, "99": 90 } } }, thresholds);

    expect(propertyOf(best, "unit_size").stars).toBe(5);
    expect(propertyOf(worst, "unit_size").stars).toBe(1);
  });

  it("is held back by its worst share", () => {
    const score = scoreOpenTrack({ histograms: { unit_size: { "5": 94, "50": 6 } } }, thresholds);

    expect(propertyOf(score, "unit_size").stars).toBe(3);
  });

  it("rates a share property against its single limit per level", () => {
    const score = scoreOpenTrack({ shares: { duplication: 0.05 } }, thresholds);

    expect(propertyOf(score, "duplication")).toMatchObject({ stars: 3, share: 0.05 });
  });

  it("rates a higher-is-better share against its minimum per level", () => {
    const at = (share: number) =>
      propertyOf(scoreOpenTrack({ shares: { component_independence: share } }, thresholds), "component_independence");

    expect(at(0.7)).toMatchObject({ stars: 4, atLeast: true });
    expect(at(0.95).stars).toBe(5);
    expect(at(0.1).stars).toBe(1);
  });

  it("says why a property has no stars", () => {
    const score = scoreOpenTrack({}, thresholds);

    expect(propertyOf(score, "unit_size")).toMatchObject({ stars: null, reason: "not measured" });
    expect(propertyOf(score, "module_coupling")).toMatchObject({
      stars: null,
      reason: "not calibrated: no benchmark measures yet",
    });
    expect(propertyOf(score, "unit_complexity").reason).toBe("not calibrated: no thresholds in this version");
    expect(score.rating).toBeNull();
  });

  it("rates the whole as the mean of the rated properties", () => {
    const score = scoreOpenTrack({ histograms: { unit_size: { "3": 100 } }, shares: { duplication: 0.05 } }, thresholds);

    expect(score.rating).toBe(4);
    expect(score.properties.map((entry) => entry.property)).toEqual([...OPEN_TRACK_PROPERTIES]);
  });
});

describe("the published open-track thresholds", () => {
  const benchmark = JSON.parse(readFileSync(path.join(BENCHMARK_DIR, "benchmark.json"), "utf8")) as {
    version: string;
    repositories: Array<{ name: string; measured: Record<string, { stars: number }> }>;
  };

  it("come from the benchmark list published next to them", () => {
    expect(OPEN_TRACK_THRESHOLDS.version).toBe(benchmark.version);
    expect(OPEN_TRACK_THRESHOLDS.benchmark.repositories).toBe(benchmark.repositories.length);
    expect(benchmark.repositories.length).toBeGreaterThanOrEqual(40);
  });

  it("have rising bounds and limits that loosen with every star less", () => {
    for (const threshold of Object.values(OPEN_TRACK_THRESHOLDS.properties)) {
      const levels = ["5", "4", "3", "2"];
      if (threshold.kind === "risk-profile") {
        expect(threshold.bounds).toEqual([...threshold.bounds].sort((a, b) => a - b));
        expect(new Set(threshold.bounds).size).toBe(3);
        for (let i = 1; i < levels.length; i++) {
          threshold.stars[levels[i]].forEach((cap, index) =>
            expect(cap).toBeGreaterThanOrEqual(threshold.stars[levels[i - 1]][index])
          );
        }
      } else if (threshold.kind === "share-min") {
        for (let i = 1; i < levels.length; i++) {
          expect(threshold.stars[levels[i]]).toBeLessThanOrEqual(threshold.stars[levels[i - 1]]);
        }
      } else {
        for (let i = 1; i < levels.length; i++) {
          expect(threshold.stars[levels[i]]).toBeGreaterThanOrEqual(threshold.stars[levels[i - 1]]);
        }
      }
    }
  });

  it("rate every benchmark repository as the derivation script did", () => {
    const measuresDir = path.join(BENCHMARK_DIR, "measures");
    const couplingDir = path.join(BENCHMARK_DIR, "coupling");
    const couplingOf = (file: string) => {
      const full = path.join(couplingDir, file);
      return existsSync(full) ? JSON.parse(readFileSync(full, "utf8")) : undefined;
    };
    const byName = new Map(
      readdirSync(measuresDir).map((file) => {
        const measures = JSON.parse(readFileSync(path.join(measuresDir, file), "utf8")) as OpenTrackScriptMeasures & {
          name: string;
        };
        return [measures.name, { measures, coupling: couplingOf(file) }] as const;
      })
    );

    for (const repository of benchmark.repositories) {
      const { measures, coupling } = byName.get(repository.name)!;
      const own = openTrackInput(measures);
      const extra = openTrackExtras([{ openTrack: { coupling } }]);
      const score = scoreOpenTrack({
        histograms: { ...own.histograms, ...extra.histograms },
        shares: { ...own.shares, ...extra.shares },
      });
      for (const [property, measured] of Object.entries(repository.measured)) {
        expect({ repository: repository.name, property, stars: propertyOf(score, property).stars }).toEqual({
          repository: repository.name,
          property,
          stars: measured.stars,
        });
      }
    }
  });
});
