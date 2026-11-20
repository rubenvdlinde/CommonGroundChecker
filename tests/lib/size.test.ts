import { describe, expect, it } from "vitest";
import {
  QSM_LINES_PER_FUNCTION_POINT,
  SIG_V17_LINES_PER_PERSON_YEAR,
  parseSize,
  proxyNote,
  sizeEstimates,
  sizeFamily,
  sizeFromScc,
  sizeSummary,
  type SccLanguage,
} from "@/lib/size";
import type { SizeMeasurement } from "@/lib/types";
import openRegisterFixture from "../fixtures/size-openregister.json";
import openZaakFixture from "../fixtures/size-open-zaak.json";

const openRegister = openRegisterFixture as SizeMeasurement;
const openZaak = openZaakFixture as SizeMeasurement;

const SCC: SccLanguage[] = [
  {
    Name: "PHP",
    Files: [
      { Location: "./lib/Service/A.php", Extension: "php", Code: 120 },
      { Location: "./tests/Unit/ATest.php", Extension: "php", Code: 300 },
    ],
  },
  { Name: "Vue", Files: [{ Location: "src/views/Main.vue", Extension: "vue", Code: 80 }] },
  { Name: "Markdown", Files: [{ Location: "README.md", Extension: "md", Code: 40 }] },
  { Name: "Python", Files: [{ Location: "app/models.py", Extension: "py", Code: 120 }] },
];

describe("sizeFromScc", () => {
  it("counts only the files in scope, per language, largest first", () => {
    const size = sizeFromScc(SCC, ["lib/Service/A.php", "src/views/Main.vue", "app/models.py"], "scc 4.1.0");

    expect(size).toEqual({
      tool: "scc 4.1.0",
      files: 3,
      loc: 320,
      languages: [
        { language: "PHP", family: "php", files: 1, loc: 120 },
        { language: "Python", family: "python", files: 1, loc: 120 },
        { language: "Vue", family: "vue", files: 1, loc: 80 },
      ],
    });
  });

  it("matches paths with or without a leading ./ and with backslashes", () => {
    const size = sizeFromScc(SCC, ["./lib/Service/A.php", "src\\views\\Main.vue"], "scc 4.1.0");

    expect(size.languages.map((language) => language.language)).toEqual(["PHP", "Vue"]);
  });

  it("is empty when nothing is in scope", () => {
    expect(sizeFromScc(SCC, [], "scc 4.1.0")).toMatchObject({ files: 0, loc: 0, languages: [] });
  });
});

describe("sizeFamily", () => {
  it("maps scc language names, and falls back on the extension", () => {
    expect(sizeFamily("TypeScript Typings")).toBe("typescript");
    expect(sizeFamily("Sass")).toBe("css");
    expect(sizeFamily("Unknown Template", "twig")).toBe("html");
    expect(sizeFamily("Markdown", "md")).toBeNull();
  });
});

describe("sizeEstimates", () => {
  it("reproduces the volume lane's figures for OpenRegister from the measured lines", () => {
    const estimates = sizeEstimates(openRegister);

    expect(openRegister.loc).toBe(555758);
    expect(estimates.sigStylePersonYears).toBeCloseTo(59.7, 1);
    expect(estimates.rebuildPersonYears).toBeCloseTo(49.7, 1);
    expect(Math.round(estimates.functionPoints)).toBe(11852);
    expect(estimates.backfiringProxies.sort()).toEqual(["css", "php", "typescript", "vue"]);
    expect(estimates.sigStyleProxies.sort()).toEqual(["css", "php", "sql", "vue"]);
  });

  it("reproduces the volume lane's figures for Open Zaak", () => {
    const estimates = sizeEstimates(openZaak);

    expect(openZaak.loc).toBe(42010);
    expect(estimates.sigStylePersonYears).toBeCloseTo(6.4, 1);
    expect(estimates.rebuildPersonYears).toBeCloseTo(4.1, 1);
    expect(Math.round(estimates.functionPoints)).toBe(914);
  });

  it("applies the factors per language", () => {
    const estimates = sizeEstimates({
      tool: "scc 4.1.0",
      files: 2,
      loc: 36300 + 3400,
      languages: [
        { language: "JavaScript", family: "javascript", files: 1, loc: 36300 },
        { language: "HTML", family: "html", files: 1, loc: 3400 },
      ],
    });

    expect(estimates.functionPoints).toBeCloseTo(36300 / 47 + 100, 6);
    expect(estimates.rebuildPersonYears).toBeCloseTo(((36300 / 47) * 7.6 + 100 * 13.7) / 1824, 6);
    expect(estimates.sigStylePersonYears).toBeCloseTo(3.9 + 3400 / (36300 / 3.9), 6);
    expect(estimates.backfiringProxies).toEqual([]);
    expect(estimates.sigStyleProxies).toEqual(["html"]);
  });

  it("leaves lines without a family out of both estimates", () => {
    const estimates = sizeEstimates({
      tool: "scc 4.1.0",
      files: 1,
      loc: 500,
      languages: [{ language: "Elm", family: null, files: 1, loc: 500 }],
    });

    expect(estimates).toMatchObject({ functionPoints: 0, rebuildPersonYears: 0, sigStylePersonYears: 0, unmodelledLoc: 500 });
  });
});

describe("sizeSummary", () => {
  it("gives the total lines and says the size is not rated", () => {
    expect(sizeSummary(openRegister)).toBe("555,758 lines of code, not rated");
  });
});

describe("proxyNote", () => {
  it("names the families per borrowed factor", () => {
    expect(proxyNote(["php", "vue", "css"], QSM_LINES_PER_FUNCTION_POINT)).toBe(
      "PHP and Vue use the JavaScript factor; CSS uses the HTML factor"
    );
    expect(proxyNote(["php", "vue", "html"], SIG_V17_LINES_PER_PERSON_YEAR)).toBe(
      "PHP, Vue and HTML use the JavaScript factor"
    );
    expect(proxyNote([], SIG_V17_LINES_PER_PERSON_YEAR)).toBeNull();
  });
});

describe("parseSize", () => {
  it("reads a stored size and recounts its totals", () => {
    expect(parseSize(openZaak)).toEqual(openZaak);
  });

  it("drops malformed rows and an unknown family", () => {
    const size = parseSize({
      tool: "scc 4.1.0",
      languages: [
        { language: "PHP", family: "php", files: 2, loc: 100 },
        { language: "Elm", family: "elm", files: 1, loc: 10 },
        { language: "Broken", files: "1", loc: 5 },
        "nonsense",
      ],
    });

    expect(size).toEqual({
      tool: "scc 4.1.0",
      files: 3,
      loc: 110,
      languages: [
        { language: "PHP", family: "php", files: 2, loc: 100 },
        { language: "Elm", family: null, files: 1, loc: 10 },
      ],
    });
  });

  it("is undefined for anything that is not a size", () => {
    expect(parseSize(undefined)).toBeUndefined();
    expect(parseSize({ languages: [] })).toBeUndefined();
    expect(parseSize([])).toBeUndefined();
  });
});
