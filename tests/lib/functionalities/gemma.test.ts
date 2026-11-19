import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArchimate, taxonomyFromGemma, taxonomySlug } from "@/lib/functionalities/gemma";
import { readTaxonomy, taxonomyProblems } from "@/lib/functionalities/taxonomy";
import { parseYaml } from "@/lib/staticSite/config";

const root = path.resolve(__dirname, "../../..");

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id-model">
  <name xml:lang="nl">GEMMA</name>
  <properties>
    <property propertyDefinitionRef="propid-75">
      <value xml:lang="nl">2026-09-09</value>
    </property>
  </properties>
  <elements>
    <element identifier="id-zrc" xsi:type="ApplicationComponent">
      <name xml:lang="nl">Zaakregistratiecomponent</name>
      <documentation xml:lang="nl">Component voor opslag en ontsluiting van zaakgegevens.</documentation>
      <properties>
        <property propertyDefinitionRef="propid-1"><value xml:lang="nl">Referentiecomponent</value></property>
        <property propertyDefinitionRef="propid-2"><value xml:lang="nl">guid-zrc</value></property>
        <property propertyDefinitionRef="propid-3"><value xml:lang="nl">In gebruik</value></property>
      </properties>
    </element>
    <element identifier="id-pdc" xsi:type="ApplicationComponent">
      <name xml:lang="nl">Producten-en-dienstencataloguscomponent</name>
      <properties>
        <property propertyDefinitionRef="propid-1"><value xml:lang="nl">Referentiecomponent</value></property>
        <property propertyDefinitionRef="propid-2"><value xml:lang="nl">guid-pdc</value></property>
      </properties>
    </element>
    <element identifier="id-pgb" xsi:type="ApplicationComponent">
      <name xml:lang="nl">Mijn PGB portaal</name>
      <properties>
        <property propertyDefinitionRef="propid-1"><value xml:lang="nl">Buitengemeentelijke voorziening</value></property>
      </properties>
    </element>
    <element identifier="id-zaken" xsi:type="ApplicationService">
      <name xml:lang="nl">Registreren en delen van zaken</name>
      <documentation xml:lang="nl">Zaken &amp; zaakgegevens.</documentation>
      <properties>
        <property propertyDefinitionRef="propid-2"><value xml:lang="nl">guid-zaken</value></property>
      </properties>
    </element>
    <element identifier="id-geleiden" xsi:type="ApplicationService">
      <name xml:lang="nl">Geleiden van klanten</name>
    </element>
    <element identifier="id-unused" xsi:type="ApplicationService">
      <name xml:lang="nl">Niet gerealiseerd</name>
    </element>
  </elements>
  <relationships>
    <relationship identifier="r1" source="id-zrc" target="id-zaken" xsi:type="Realization" />
    <relationship identifier="r2" source="id-pdc" target="id-geleiden" xsi:type="Realization">
      <name xml:lang="nl">realiseert</name>
    </relationship>
    <relationship identifier="r3" source="id-pgb" target="id-unused" xsi:type="Realization" />
    <relationship identifier="r4" source="id-zrc" target="id-geleiden" xsi:type="Serving" />
  </relationships>
  <propertyDefinitions>
    <propertyDefinition identifier="propid-1" type="string"><name>GEMMA type</name></propertyDefinition>
    <propertyDefinition identifier="propid-2" type="string"><name>Object ID</name></propertyDefinition>
    <propertyDefinition identifier="propid-3" type="string"><name>GEMMA status</name></propertyDefinition>
    <propertyDefinition identifier="propid-75" type="string"><name>Release</name></propertyDefinition>
  </propertyDefinitions>
</model>`;

describe("parseArchimate", () => {
  it("reads elements, their properties by name, relationships and the model properties", () => {
    const model = parseArchimate(XML);
    expect(model.properties).toEqual({ Release: "2026-09-09" });
    expect(model.elements).toHaveLength(6);
    expect(model.elements[3]).toMatchObject({
      identifier: "id-zaken",
      type: "ApplicationService",
      documentation: "Zaken & zaakgegevens.",
      properties: { "Object ID": "guid-zaken" },
    });
    expect(model.relationships).toHaveLength(4);
  });
});

describe("taxonomyFromGemma", () => {
  it("keeps the reference components and the application services they realise", () => {
    const taxonomy = taxonomyFromGemma(XML, { url: "https://example.org/gemma", commit: "abc" });
    expect(taxonomy.source).toEqual({
      name: "GEMMA",
      url: "https://example.org/gemma",
      commit: "abc",
      release: "2026-09-09",
      licence: "EUPL-1.2",
    });
    expect(taxonomy.referenceComponents.map((component) => component.id)).toEqual([
      "producten-en-dienstencataloguscomponent",
      "zaakregistratiecomponent",
    ]);
    expect(taxonomy.referenceComponents[1]).toEqual({
      id: "zaakregistratiecomponent",
      name: "Zaakregistratiecomponent",
      gemmaId: "guid-zrc",
      description: "Component voor opslag en ontsluiting van zaakgegevens.",
      status: "In gebruik",
      functionalities: ["registreren-en-delen-van-zaken"],
    });
    expect(taxonomy.functionalities.map((functionality) => functionality.id)).toEqual([
      "geleiden-van-klanten",
      "registreren-en-delen-van-zaken",
    ]);
    // A service without an Object ID keeps its ArchiMate identifier.
    expect(taxonomy.functionalities[0].gemmaId).toBe("id-geleiden");
    expect(taxonomyProblems(taxonomy)).toEqual([]);
  });

  it("makes ids from names without accents or punctuation", () => {
    expect(taxonomySlug("Ideeëncomponent")).toBe("ideeencomponent");
    expect(taxonomySlug("Oninterpreteerbaar maken van niet-openbare informatie ('weglakken')")).toBe(
      "oninterpreteerbaar-maken-van-niet-openbare-informatie-weglakken"
    );
  });
});

describe("config/functionalities.yml", () => {
  it("is a consistent GEMMA taxonomy", () => {
    const taxonomy = readTaxonomy(parseYaml(readFileSync(path.join(root, "config/functionalities.yml"), "utf-8")));
    expect(taxonomy.source.name).toBe("GEMMA");
    expect(taxonomy.source.licence).toBe("EUPL-1.2");
    expect(taxonomy.functionalities.length).toBeGreaterThan(100);
    expect(taxonomy.referenceComponents.length).toBeGreaterThan(100);
    expect(taxonomyProblems(taxonomy)).toEqual([]);
    expect(taxonomy.functionalities.find((functionality) => functionality.id === "registreren-en-delen-van-zaken")?.name).toBe(
      "Registreren en delen van zaken"
    );
  });
});
