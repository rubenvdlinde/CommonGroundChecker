import { describe, expect, it } from "vitest";
import { readHistoryParams } from "@/components/StaticHistoryIndex";
import { matchesRepositorySearch } from "@/lib/historySearch";

describe("readHistoryParams", () => {
  it("reads sort, direction and search from the URL with the server's defaults", () => {
    const noFilter = { status: null, basisset: false, functionality: null, standard: null };
    expect(readHistoryParams(new URLSearchParams(""))).toEqual({ sort: "rating", direction: "desc", query: "", filter: noFilter });
    expect(readHistoryParams(new URLSearchParams("sort=score&direction=asc&q=%20zaak%20"))).toEqual({
      sort: "score",
      direction: "asc",
      query: "zaak",
      filter: noFilter,
    });
    expect(readHistoryParams(new URLSearchParams("sort=stars&direction=up"))).toEqual({
      sort: "rating",
      direction: "desc",
      query: "",
      filter: noFilter,
    });
  });

  it("reads the Common Ground status filter and the basisset chip from the URL", () => {
    expect(readHistoryParams(new URLSearchParams("status=maintained&basisset=1")).filter).toEqual({
      status: "maintained",
      basisset: true,
      functionality: null,
      standard: null,
    });
  });

  it("reads the functionality and the standard from the URL", () => {
    expect(
      readHistoryParams(new URLSearchParams("functionality=registreren-en-delen-van-zaken&standard=zgw-zaken")).filter
    ).toEqual({ status: null, basisset: false, functionality: "registreren-en-delen-van-zaken", standard: "zgw-zaken" });
  });
});

describe("matchesRepositorySearch", () => {
  const repository = {
    owner: "open-zaak",
    name: "open-notificaties",
    repoUrl: "https://github.com/open-zaak/open-notificaties",
    description: "Notificaties API",
    displayName: "Open Notificaties",
    shortDescription: null,
    topics: ["commonground"],
  };

  it("matches owner, name, URL and description ignoring case, and topics exactly", () => {
    expect(matchesRepositorySearch(repository, "")).toBe(true);
    expect(matchesRepositorySearch(repository, "ZAAK")).toBe(true);
    expect(matchesRepositorySearch(repository, "notificaties api")).toBe(true);
    expect(matchesRepositorySearch(repository, "commonground")).toBe(true);
    expect(matchesRepositorySearch(repository, "common")).toBe(false);
  });
});
