import { describe, expect, it } from "vitest";
import {
  COMMON_GROUND_LAYER_URI,
  STANDARD_FAMILIES,
  crossCheckStandards,
  describeDeclaredStandard,
  matchOpenApiDocument,
  openApiResources,
  readSupportsIds,
  resolveSupportsId,
  standardUri,
} from "@/lib/standards";

const ZAKEN_151 = "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html";
const ADR_210 = "https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/";

function family(id: string) {
  const found = STANDARD_FAMILIES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("the registry of standards", () => {
  it("resolves the URI of every listed version back to that version", () => {
    for (const standard of STANDARD_FAMILIES.filter((candidate) => candidate.uriTemplate)) {
      expect(standard.versions.length, standard.id).toBeGreaterThan(0);
      for (const version of standard.versions) {
        const resolved = resolveSupportsId(standardUri(standard, version) as string);
        expect(resolved).toMatchObject({ kind: "known", version });
        expect(resolved.kind === "known" && resolved.family.id).toBe(standard.id);
      }
    }
  });

  it("uses every family id once and only http(s) sources", () => {
    const ids = STANDARD_FAMILIES.map((standard) => standard.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const standard of STANDARD_FAMILIES) expect(new URL(standard.source.url).protocol).toBe("https:");
  });

  it("gives no URI for a standard whose URI is still to agree", () => {
    expect(standardUri(family("brp-personen"), "2.7.0")).toBeNull();
    expect(family("brp-personen").openApiTitles).toEqual(["BRP API Personen"]);
  });
});

describe("resolveSupportsId", () => {
  it("names a known version", () => {
    const resolved = resolveSupportsId(ZAKEN_151);
    expect(resolved.kind).toBe("known");
    expect(describeDeclaredStandard(resolved)).toBe("Zaken API 1.5.1");
    expect(describeDeclaredStandard(resolveSupportsId(ADR_210))).toBe("NL API Design Rules 2.1.0");
  });

  it("recognises a version the registry does not list yet", () => {
    const resolved = resolveSupportsId("https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.9.0.html");
    expect(resolved).toMatchObject({ kind: "unlisted-version", version: "1.9.0" });
    expect(describeDeclaredStandard(resolved)).toBe("Zaken API 1.9.0 (version not in the registry)");
  });

  it("ignores the case of scheme and host and surrounding space, but not of the path", () => {
    expect(resolveSupportsId(`  HTTPS://VNG-Realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html `).kind).toBe(
      "known"
    );
    expect(resolveSupportsId(ZAKEN_151.replace("/zaken/", "/Zaken/")).kind).toBe("unknown");
  });

  it("does not take a version shortcut or a different path for a known version", () => {
    expect(resolveSupportsId("https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1/")).toMatchObject({
      kind: "unlisted-version",
      version: "2.1",
    });
    expect(resolveSupportsId("https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0").kind).toBe("unknown");
  });

  it("names aliases of the publiccode.yml alias list, and treats an unknown alias as unknown", () => {
    expect(resolveSupportsId("alias:gdpr")).toEqual({ kind: "alias", id: "alias:gdpr", name: "GDPR (AVG)" });
    expect(resolveSupportsId("alias:nonexistent").kind).toBe("unknown");
  });

  it("recognises the Common Ground layer", () => {
    expect(resolveSupportsId(`${COMMON_GROUND_LAYER_URI}#data`)).toEqual({
      kind: "layer",
      id: `${COMMON_GROUND_LAYER_URI}#data`,
      layer: "data",
    });
  });

  it("returns an unknown URI as is", () => {
    const resolved = resolveSupportsId("https://example.org/standard/1.0");
    expect(resolved.kind).toBe("unknown");
    expect(describeDeclaredStandard(resolved)).toBe("https://example.org/standard/1.0");
  });
});

describe("readSupportsIds", () => {
  it("reads the ids in order, without duplicates and empty entries", () => {
    expect(
      readSupportsIds({
        supports: [{ id: ZAKEN_151 }, { id: " " }, "not an entry", { name: "no id" }, { id: ` ${ZAKEN_151}` }, { id: ADR_210 }],
      })
    ).toEqual([ZAKEN_151, ADR_210]);
  });

  it("reads nothing from a file without supports", () => {
    expect(readSupportsIds(null)).toEqual([]);
    expect(readSupportsIds([])).toEqual([]);
    expect(readSupportsIds({ supports: "alias:gdpr" })).toEqual([]);
  });
});

describe("matchOpenApiDocument", () => {
  it("matches the official info.title, ignoring case, and keeps the version", () => {
    expect(matchOpenApiDocument({ info: { title: "zaken api", version: "1.5.1" } }, "api/zrc.yaml")).toMatchObject([
      { family: { id: "zgw-zaken" }, version: "1.5.1", file: "api/zrc.yaml", method: "title" },
    ]);
    expect(matchOpenApiDocument({ info: { title: "BRP API Personen", version: 2 } }, "spec.yaml")).toMatchObject([
      { family: { id: "brp-personen" }, version: "2", method: "title" },
    ]);
  });

  it("matches a renamed specification by the standard's top-level resources", () => {
    const openNotificaties = {
      info: { title: "Open Notificaties API", version: "1.1.0" },
      paths: { "/abonnement": {}, "/abonnement/{uuid}": {}, "/kanaal": {}, "/kanaal/{uuid}": {}, "/notificaties": {} },
    };
    expect(matchOpenApiDocument(openNotificaties, "src/openapi.yaml")).toMatchObject([
      { family: { id: "zgw-notificaties" }, version: "1.1.0", method: "paths" },
    ]);
  });

  it("reads resources after a version segment, and not from nested paths", () => {
    const zaken = {
      info: { title: "Zaken", version: "1.3.0" },
      paths: {
        "/api/v1/zaken": {},
        "/api/v1/statussen": {},
        "/api/v1/resultaten": {},
        "/api/v1/zaken/{zaak_uuid}/besluiten": {},
        "/api/v1/zaakinformatieobjecten": {},
      },
    };
    expect(matchOpenApiDocument(zaken, "a.yaml").map((found) => found.family.id)).toEqual(["zgw-zaken"]);
  });

  it("finds every standard a combined specification implements", () => {
    const combined = {
      info: { title: "Gateway" },
      paths: { "/zaken": {}, "/statussen": {}, "/resultaten": {}, "/catalogussen": {}, "/zaaktypen/{uuid}": {}, "/zaaktypen": {} },
    };
    expect(matchOpenApiDocument(combined, "a.yaml").map((found) => [found.family.id, found.version])).toEqual([
      ["zgw-zaken", null],
      ["zgw-catalogi", null],
    ]);
  });

  it("finds nothing in another API or a document that is not a specification", () => {
    expect(matchOpenApiDocument({ info: { title: "OpenRegister API" }, paths: { "/zaken": {} } }, "a.yaml")).toEqual([]);
    expect(matchOpenApiDocument({ openapi: "3.0.0" }, "a.yaml")).toEqual([]);
    expect(matchOpenApiDocument("text", "a.yaml")).toEqual([]);
  });

  it("keeps a document without a version as found without one", () => {
    expect(matchOpenApiDocument({ info: { title: "Objects API" } }, "a.yaml")[0]?.version).toBeNull();
  });
});

describe("openApiResources", () => {
  it("takes the first segment after the last version segment, else the first, and skips parameters", () => {
    expect([...openApiResources({ "/api/v1/zaken/{uuid}": {}, "/kanaal": {}, "/{id}": {}, "/": {} })]).toEqual([
      "zaken",
      "kanaal",
    ]);
    expect(openApiResources(null).size).toBe(0);
  });
});

describe("crossCheckStandards", () => {
  const found = (id: string, version: string, file: string) => ({ family: family(id), version, file, method: "title" as const });

  it("sorts declared and found standards into the three groups", () => {
    const declared = [
      ZAKEN_151,
      "https://vng-realisatie.github.io/gemma-zaken/standaard/besluiten/redoc-1.1.0.html",
      ADR_210,
      "alias:gdpr",
      "https://example.org/x",
    ].map(resolveSupportsId);
    const result = crossCheckStandards(declared, [
      found("zgw-zaken", "1.5.1", "src/zaken/openapi.yaml"),
      found("zgw-catalogi", "1.3.3", "src/catalogi/openapi.yaml"),
    ]);

    expect(result.declaredAndFound.map((pair) => describeDeclaredStandard(pair.declared))).toEqual(["Zaken API 1.5.1"]);
    expect(result.declaredNotFound.map(describeDeclaredStandard)).toEqual(["Besluiten API 1.1.0"]);
    expect(result.foundNotDeclared.map((spec) => `${spec.family.name} ${spec.version}`)).toEqual(["Catalogi API 1.3.3"]);
  });

  it("treats another version of a declared standard as declared but not found, and found but not declared", () => {
    const result = crossCheckStandards([resolveSupportsId(ZAKEN_151)], [found("zgw-zaken", "1.6.0", "openapi.yaml")]);
    expect(result.declaredAndFound).toEqual([]);
    expect(result.declaredNotFound).toHaveLength(1);
    expect(result.foundNotDeclared[0].version).toBe("1.6.0");
  });
});
