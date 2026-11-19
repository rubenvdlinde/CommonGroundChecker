import { describe, expect, it, vi } from "vitest";
import {
  basissetOverview,
  BASISSET_URL,
  compareVersions,
  compareWithBasisset,
  describeBasissetEntry,
  describeVersionComparison,
  isInBasisset,
  loadBasisset,
  matchBasisset,
  normaliseRepoUrl,
  parseBasisset,
  type Basisset,
} from "@/lib/basisset";

/** Entries as VNG publishes them in data/components.json (version 0.3.1, 19 November 2026). */
const document = {
  version: "0.3.1",
  components: [
    { name: "OpenZaak", status: "g", architectureLayers: "1-2", basisset: true, repo: ["https://github.com/open-zaak/open-zaak"], version: "1.29.0" },
    { name: "OpenNotificaties", status: "g", architectureLayers: "3", basisset: true, repo: ["https://github.com/open-zaak/open-notificaties"], version: "1.16.1" },
    { name: "OpenRegister", status: "g", architectureLayers: "1-2", basisset: true, repo: ["https://codeberg.org/Conduction/openregister"], version: "1.0.3" },
    { name: "OpenFSC Inway", status: "g", architectureLayers: "3", basisset: true, repo: ["https://gitlab.com/rinis-oss/fsc/open-fsc"], version: "2.4.0" },
    { name: "OpenFSC Outway", status: "g", architectureLayers: "3", basisset: true, repo: ["https://gitlab.com/rinis-oss/fsc/open-fsc"], version: "2.4.0" },
    { name: "OpenFSC Signing Service", status: "i.o.", architectureLayers: "3", basisset: true, repo: ["https://gitlab.com/rinis-oss/fsc/open-fsc"], version: "3.0.0-rc.1" },
    { name: "OpenFormulieren", status: "g", architectureLayers: "4-5", basisset: false, repo: ["https://github.com/open-formulieren/open-forms"], version: "4.1.0" },
    { name: "ZAC", status: "g", architectureLayers: "4-5", basisset: false, repo: ["https://github.com/infonl/dimpact-zaakafhandelcomponent/tree/main"], version: "3.854" },
    { name: "Register Burgerzaken", status: "i.o.", architectureLayers: "1-2", basisset: true },
    { description: "no name" },
  ],
};

const basisset = parseBasisset(document) as Basisset;

describe("parseBasisset", () => {
  it("reads the version and every named entry, with missing fields made empty", () => {
    expect(basisset.version).toBe("0.3.1");
    expect(basisset.components).toHaveLength(9);
    expect(basisset.components[8]).toEqual({
      name: "Register Burgerzaken",
      repo: [],
      version: null,
      description: "",
      status: "i.o.",
      architectureLayers: "1-2",
      basisset: true,
      note: null,
    });
    expect(basisset.components[6].basisset).toBe(false);
  });

  it("is null for something that is not the document", () => {
    expect(parseBasisset(null)).toBeNull();
    expect(parseBasisset({ components: "no" })).toBeNull();
    expect(parseBasisset([])).toBeNull();
  });
});

describe("normaliseRepoUrl", () => {
  it("drops the scheme, www, .git, a trailing slash, a query and the case", () => {
    expect(normaliseRepoUrl("https://www.GitHub.com/Open-Zaak/open-zaak.git/")).toBe("github.com/open-zaak/open-zaak");
    expect(normaliseRepoUrl("http://github.com/open-zaak/open-zaak?tab=readme#top")).toBe("github.com/open-zaak/open-zaak");
    expect(normaliseRepoUrl("git@gitlab.com:rinis-oss/fsc/open-fsc.git")).toBe("gitlab.com/rinis-oss/fsc/open-fsc");
  });

  it("drops a path into a branch on GitHub, GitLab and Forgejo", () => {
    expect(normaliseRepoUrl("https://github.com/infonl/dimpact-zaakafhandelcomponent/tree/main")).toBe(
      "github.com/infonl/dimpact-zaakafhandelcomponent"
    );
    expect(normaliseRepoUrl("https://gitlab.com/rinis-oss/fsc/open-fsc/-/tree/main/docs")).toBe("gitlab.com/rinis-oss/fsc/open-fsc");
    expect(normaliseRepoUrl("https://codeberg.org/Conduction/openregister/src/branch/main")).toBe("codeberg.org/conduction/openregister");
  });
});

describe("compareVersions", () => {
  it("compares by semver precedence, with or without a leading v", () => {
    expect(compareVersions("1.31.2", "1.29.0")).toBe(1);
    expect(compareVersions("v1.29.0", "1.29.0")).toBe(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  it("counts missing numbers as 0", () => {
    expect(compareVersions("1.29", "1.29.0")).toBe(0);
    expect(compareVersions("3.854", "3.900.1")).toBe(-1);
  });

  it("puts a pre-release before its release", () => {
    expect(compareVersions("3.0.0-rc.1", "3.0.0")).toBe(-1);
    expect(compareVersions("3.0.0-rc.2", "3.0.0-rc.10")).toBe(-1);
    expect(compareVersions("3.0.0", "2.4.0")).toBe(1);
  });

  it("is null when a value is not a version", () => {
    expect(compareVersions("main", "1.0.0")).toBeNull();
  });

  it("says equal, newer, older or unknown against the basisset", () => {
    expect(compareWithBasisset("1.29.0", "1.29.0")).toBe("equal");
    expect(compareWithBasisset("1.31.2", "1.29.0")).toBe("newer");
    expect(compareWithBasisset("1.16.0", "1.16.1")).toBe("older");
    expect(compareWithBasisset(null, "1.0.0")).toBe("unknown");
    expect(compareWithBasisset("1.0.0", null)).toBe("unknown");
    expect(compareWithBasisset("main", "1.0.0")).toBe("unknown");
  });
});

describe("matchBasisset", () => {
  it("finds Open Zaak by its URL and calls a newer scanned version newer", () => {
    const match = matchBasisset(basisset, "https://github.com/open-zaak/open-zaak", "1.31.2");
    expect(match).toEqual({
      listVersion: "0.3.1",
      available: true,
      entries: [{ name: "OpenZaak", status: "g", version: "1.29.0", inBasisset: true, comparison: "newer" }],
      otherAddress: [],
    });
    expect(isInBasisset(match)).toBe(true);
    expect(describeBasissetEntry(match.entries[0])).toBe("In the Common Ground basisset as OpenZaak (g), version 1.29.0");
    expect(describeVersionComparison("1.31.2", match.entries[0])).toBe(
      "The scanned version 1.31.2 is newer than the basisset's 1.29.0"
    );
  });

  it("gives every entry that shares a repository, each with its own comparison", () => {
    const match = matchBasisset(basisset, "https://gitlab.com/rinis-oss/fsc/open-fsc", "2.4.0");
    expect(match.entries.map((entry) => [entry.name, entry.comparison])).toEqual([
      ["OpenFSC Inway", "equal"],
      ["OpenFSC Outway", "equal"],
      ["OpenFSC Signing Service", "older"],
    ]);
  });

  it("says when an entry is listed next to the basisset, not in it", () => {
    const match = matchBasisset(basisset, "https://github.com/open-formulieren/open-forms", "3.3.0");
    expect(match.entries[0].inBasisset).toBe(false);
    expect(isInBasisset(match)).toBe(false);
    expect(describeBasissetEntry(match.entries[0])).toBe("Listed next to the basisset as OpenFormulieren (g), version 4.1.0");
    expect(describeVersionComparison("3.3.0", match.entries[0])).toBe("The scanned version 3.3.0 is older than the basisset's 4.1.0");
  });

  it("reports an entry with the same repository name at another address, such as a stale URL", () => {
    const match = matchBasisset(basisset, "https://github.com/ConductionNL/openregister", "1.0.3");
    expect(match.entries).toEqual([]);
    expect(match.otherAddress).toEqual([{ name: "OpenRegister", repo: "https://codeberg.org/Conduction/openregister" }]);
    expect(isInBasisset(match)).toBe(false);
  });

  it("finds nothing for a repository the list does not name, and says when the list is missing", () => {
    expect(matchBasisset(basisset, "https://github.com/org/other", null).entries).toEqual([]);
    expect(matchBasisset(null, "https://github.com/open-zaak/open-zaak", "1.0.0")).toEqual({
      listVersion: null,
      available: false,
      entries: [],
      otherAddress: [],
    });
    expect(isInBasisset(null)).toBe(false);
  });

  it("describes an entry without a version or status", () => {
    expect(describeBasissetEntry({ name: "X", status: "", version: null, inBasisset: true })).toBe(
      "In the Common Ground basisset as X, no version given"
    );
    expect(describeVersionComparison("1.0.0", { version: "1.0.0", comparison: "unknown" })).toBeNull();
  });
});

describe("basissetOverview", () => {
  it("gives every entry with the repositories at its address or under its name", () => {
    const rows = basissetOverview(basisset, [
      { owner: "open-zaak", name: "open-zaak", repoUrl: "https://github.com/open-zaak/open-zaak", version: "1.31.2" },
      { owner: "ConductionNL", name: "openregister", repoUrl: "https://github.com/ConductionNL/openregister", version: null },
    ]);
    expect(rows).toHaveLength(basisset.components.length);
    expect(rows[0].matches).toEqual([
      { owner: "open-zaak", name: "open-zaak", repoUrl: "https://github.com/open-zaak/open-zaak", version: "1.31.2", comparison: "newer" },
    ]);
    expect(rows[2].matches).toEqual([]);
    expect(rows[2].otherAddress.map((repository) => repository.owner)).toEqual(["ConductionNL"]);
    expect(rows[8]).toMatchObject({ matches: [], otherAddress: [] });
  });
});

describe("loadBasisset", () => {
  it("reads the published list", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(document), { status: 200 }));
    const loaded = await loadBasisset(BASISSET_URL, fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith(BASISSET_URL, expect.objectContaining({ headers: { Accept: "application/json" } }));
    expect(loaded?.components).toHaveLength(9);
  });

  it("is null when the list cannot be read", async () => {
    const notFound = vi.fn(async () => new Response("missing", { status: 404 }));
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await loadBasisset(BASISSET_URL, notFound as unknown as typeof fetch)).toBeNull();
    expect(await loadBasisset(BASISSET_URL, offline as unknown as typeof fetch)).toBeNull();
  });
});
