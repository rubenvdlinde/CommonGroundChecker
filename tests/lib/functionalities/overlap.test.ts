import { describe, expect, it } from "vitest";
import {
  buildLandscape,
  describeOverlap,
  functionalityOverlap,
  landscapeCounts,
  unknownFunctionalities,
} from "@/lib/functionalities/overlap";
import type { FunctionalityTaxonomy } from "@/lib/functionalities/taxonomy";

const taxonomy: FunctionalityTaxonomy = {
  source: { name: "GEMMA", url: "", commit: null, release: null, licence: "EUPL-1.2" },
  referenceComponents: [
    { id: "zrc", name: "Zaakregistratiecomponent", gemmaId: "1", description: null, status: null, functionalities: ["zaken"] },
    { id: "gm", name: "Gegevensmagazijncomponent", gemmaId: "2", description: null, status: null, functionalities: ["basisgegevens"] },
  ],
  functionalities: [
    { id: "basisgegevens", name: "Registreren en delen van basisgegevens", gemmaId: "a", description: null },
    { id: "zaken", name: "Registreren en delen van zaken", gemmaId: "b", description: null },
    { id: "zoeken", name: "Beantwoorden van zoekvragen", gemmaId: "c", description: null },
  ],
};

describe("functionalityOverlap", () => {
  it("measures shared over union", () => {
    expect(functionalityOverlap(["a", "b", "c"], ["b", "c", "d"])).toEqual({
      shared: ["b", "c"],
      onlyA: ["a"],
      onlyB: ["d"],
      degree: 0.5,
    });
  });

  it("is 1 for the same list and 0 without a shared functionality", () => {
    expect(functionalityOverlap(["a", "b"], ["b", "a"]).degree).toBe(1);
    expect(functionalityOverlap(["a"], ["b"]).degree).toBe(0);
  });

  it("cannot be measured when neither lists a functionality", () => {
    expect(functionalityOverlap([], []).degree).toBeNull();
  });

  it("counts a duplicate once", () => {
    expect(functionalityOverlap(["a", "a"], ["a"])).toMatchObject({ shared: ["a"], degree: 1 });
  });
});

describe("describeOverlap", () => {
  it("names partial overlap and the part each does on its own", () => {
    expect(describeOverlap(functionalityOverlap(["a", "b", "c"], ["b", "c", "d"]), "Open Object", "OpenRegister")).toBe(
      "Open Object and OpenRegister share 2 of the 4 functionalities they list together (50%). Each also does something the other does not."
    );
  });

  it("says when one covers the other", () => {
    expect(describeOverlap(functionalityOverlap(["a"], ["a", "b"]), "A", "B")).toContain("Everything A does, B does too.");
    expect(describeOverlap(functionalityOverlap(["a", "b"], ["a"]), "A", "B")).toContain("Everything B does, A does too.");
    expect(describeOverlap(functionalityOverlap(["a"], ["a"]), "A", "B")).toContain("They do the same things.");
  });

  it("says when they do not overlap or cannot be measured", () => {
    expect(describeOverlap(functionalityOverlap(["a"], ["b"]), "A", "B")).toBe("A and B share none of their 2 functionalities. They do not overlap.");
    expect(describeOverlap(functionalityOverlap([], []), "A", "B")).toMatch(/cannot be measured/);
  });
});

describe("buildLandscape", () => {
  const components = [
    { owner: "maykinmedia", name: "open-object", displayName: "Open Object", functionalities: ["basisgegevens"], draft: true },
    { owner: "ConductionNL", name: "openregister", displayName: "OpenRegister", functionalities: ["basisgegevens", "zoeken"], draft: true },
  ];

  it("flags overlap, a single provider and gaps per functionality", () => {
    const entries = buildLandscape(taxonomy, components);
    expect(entries.map((entry) => [entry.functionality.id, entry.kind, entry.components.map((item) => item.name)])).toEqual([
      ["basisgegevens", "overlap", ["open-object", "openregister"]],
      ["zaken", "gap", []],
      ["zoeken", "single", ["openregister"]],
    ]);
    expect(entries[0].referenceComponents.map((item) => item.id)).toEqual(["gm"]);
    expect(entries[2].referenceComponents).toEqual([]);
    expect(landscapeCounts(entries)).toEqual({ overlap: 1, single: 1, gap: 1 });
  });

  it("finds ids the taxonomy does not know", () => {
    expect(unknownFunctionalities(["zaken", "teleportatie"], taxonomy)).toEqual(["teleportatie"]);
  });
});
