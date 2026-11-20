import { describe, expect, it } from "vitest";
import { checkCoupling, mapCouplingReport } from "@/lib/checkers/coupling";
import type { CouplingMeasures } from "@/lib/types";
import fixture from "../../fixtures/coupling-report.json";

const report = fixture as unknown as CouplingMeasures;

describe("mapCouplingReport", () => {
  it("shows a real report for information, without stars, and keeps the raw values", () => {
    const result = mapCouplingReport(report);

    expect(result.id).toBe("coupling");
    expect(result.status).toBe("info");
    expect(result.starRating).toBeUndefined();
    expect(result.openTrack?.coupling).toEqual(report);
    expect(result.message).toBe(
      "Measured the module structure of Python, JavaScript, TypeScript and Vue. The raw figures are shown here and rated by \"Maintainability, open track\" when that rating is available."
    );
  });

  it("keeps the code lines per fan-in of every measured language", () => {
    const coupling = mapCouplingReport(report).openTrack?.coupling;

    for (const language of Object.values(coupling?.languages ?? {})) {
      if (!language.measured) continue;
      const histogram = language.moduleCoupling.fanInHistogram;
      expect(Object.values(histogram).reduce((sum, lines) => sum + lines, 0)).toBe(language.loc);
    }
    const python = coupling?.languages.python;
    expect(python?.measured && python.moduleCoupling.fanInHistogram["0"]).toBe(4392);
  });

  it("lists the measurements per language", () => {
    const evidence = mapCouplingReport(report).evidence ?? [];

    expect(evidence[0]).toBe(
      "Python (grimp 3.18): 342 modules, 832 edges, 17 components; independence 81.2%, entanglement 0.050 (density 2.42); " +
        "fan-in profile 92.5% / 6.3% / 1.3% / 0.0% of code at 0-10 / 11-20 / 21-50 / over 50; " +
        "34 modules in 2 cycles, largest component cycle 8"
    );
    expect(evidence[1]).toBe(
      "Python components: directories below src/openzaak/ (a level is descended while one directory holds more than 80% of the modules); packages openzaak"
    );
    expect(evidence.some((line) => line.startsWith("JavaScript, TypeScript and Vue (dependency-cruiser 17.4.3): 33 modules"))).toBe(true);
  });

  it("names a language that was not measured and why", () => {
    const result = mapCouplingReport({
      ...report,
      languages: {
        ...report.languages,
        php: { measured: false, reason: "pdepend needed more than 1536 MB on a batch of 1000 files or fewer", files: 9000 },
      },
    });

    expect(result.message).toContain("Not measured: PHP.");
    expect(result.evidence).toContain("PHP: not measured: pdepend needed more than 1536 MB on a batch of 1000 files or fewer");
  });

  it("shows the import-linter contracts when the repository declares them", () => {
    const python = report.languages.python;
    if (!python.measured) throw new Error("fixture has Python measured");
    const result = mapCouplingReport({ ...report, languages: { python: { ...python, contracts: { kept: 2, broken: 1 } } } });

    expect(result.evidence).toContain("Python import-linter contracts: 2 kept, 1 broken");
  });

  it("says when there is nothing to measure", () => {
    const result = mapCouplingReport({ version: 1, languages: {} });

    expect(result.status).toBe("info");
    expect(result.message).toContain("No source code in a supported language");
    expect(result.openTrack).toBeUndefined();
  });
});

describe("checkCoupling", () => {
  it("does not measure without a cloned repository", async () => {
    const result = await checkCoupling(undefined);

    expect(result.status).toBe("info");
    expect(result.message).toContain("could not be cloned");
  });
});
