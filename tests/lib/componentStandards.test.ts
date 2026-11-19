import { describe, expect, it } from "vitest";
import {
  STANDARD_FILTER_OPTIONS,
  describeComponentStandard,
  standardsFromEvidence,
  standardsOfResults,
} from "@/lib/componentStandards";

/** The evidence of Open Zaak's "Supported standards" result in the preview, 19 Nov 2026. */
const OPEN_ZAAK = [
  "Found in the repository, not declared: Autorisaties API 1.0.0 in src/openzaak/components/autorisaties/openapi.yaml (by title)",
  "Found in the repository, not declared: Besluiten API 1.1.0 in src/openzaak/components/besluiten/openapi.yaml (by title)",
  "Found in the repository, not declared: Catalogi API 1.3.1 in src/openzaak/components/catalogi/openapi.yaml (by title)",
  "Found in the repository, not declared: Documenten API 1.6.0 in src/openzaak/components/documenten/openapi.yaml (by title)",
  "Found in the repository, not declared: Zaken API 1.5.1 in src/openzaak/components/zaken/openapi.yaml (by title)",
];

describe("standardsFromEvidence", () => {
  it("reads the standards found in OpenAPI files", () => {
    const standards = standardsFromEvidence(OPEN_ZAAK);
    expect(standards?.map((standard) => standard.id)).toEqual([
      "zgw-autorisaties",
      "zgw-besluiten",
      "zgw-catalogi",
      "zgw-documenten",
      "zgw-zaken",
    ]);
    expect(standards?.[4]).toEqual({
      id: "zgw-zaken",
      name: "Zaken API",
      versions: ["1.5.1"],
      declared: false,
      found: true,
      known: true,
    });
  });

  it("joins a declared and a found standard and keeps every version", () => {
    const standards = standardsFromEvidence([
      "Declared: Zaken API 1.5.1 (https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html)",
      "Declared: GDPR (AVG) (alias:gdpr)",
      "Not in the registry: https://example.org/my-standard",
      "Declared and found: Zaken API 1.5.1 in src/openapi.yaml (by title)",
      "Found in the repository, not declared: Zaken API 1.4.0 in old/openapi.yaml (by paths)",
      "Declared, not found in the repository: GDPR (AVG)",
    ]);
    expect(standards).toEqual([
      { id: "alias:gdpr", name: "GDPR (AVG)", versions: [], declared: true, found: false, known: true },
      { id: "https://example.org/my-standard", name: "https://example.org/my-standard", versions: [], declared: true, found: false, known: false },
      { id: "zgw-zaken", name: "Zaken API", versions: ["1.5.1", "1.4.0"], declared: true, found: true, known: true },
    ]);
  });

  it("does not read the Objecttypes API as the Objects API", () => {
    const standards = standardsFromEvidence([
      "Found in the repository, not declared: Objecttypes API 2.2.0 in src/objecttypes/api/v2/openapi.yaml (by title)",
      "Found in the repository, not declared: Objects API (no version) in src/openapi.yaml (by title)",
    ]);
    expect(standards?.map((standard) => [standard.id, standard.versions])).toEqual([
      ["objects-api", []],
      ["objecttypes-api", ["2.2.0"]],
    ]);
  });

  it("keeps not measured apart from none", () => {
    expect(standardsFromEvidence(null)).toBeNull();
    expect(standardsFromEvidence([])).toEqual([]);
    expect(standardsOfResults([{ id: "license" }])).toBeNull();
    expect(standardsOfResults([{ id: "standards", evidence: OPEN_ZAAK }])).toHaveLength(5);
  });
});

describe("describeComponentStandard", () => {
  it("says how the standard was found", () => {
    const [zaken] = standardsFromEvidence([
      "Declared and found: Zaken API 1.5.1 in src/openapi.yaml (by title)",
      "Declared: Zaken API 1.5.1 (https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html)",
    ])!;
    expect(describeComponentStandard(zaken)).toBe("Zaken API 1.5.1, declared and found");
  });
});

describe("STANDARD_FILTER_OPTIONS", () => {
  it("lists every standard of the registry by name", () => {
    expect(STANDARD_FILTER_OPTIONS.some((option) => option.id === "zgw-notificaties")).toBe(true);
    const names = STANDARD_FILTER_OPTIONS.map((option) => option.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
