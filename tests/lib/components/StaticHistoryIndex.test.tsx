import { describe, expect, it } from "vitest";
import { readHistoryParams } from "@/components/StaticHistoryIndex";
import { matchesRepositorySearch } from "@/lib/historySearch";
import { SERVER_NAV_LINKS, STATIC_NAV_LINKS } from "@/lib/navigation";

describe("readHistoryParams", () => {
  it("reads sort, direction and search from the URL with the server's defaults", () => {
    expect(readHistoryParams(new URLSearchParams(""))).toEqual({ sort: "rating", direction: "desc", query: "" });
    expect(readHistoryParams(new URLSearchParams("sort=score&direction=asc&q=%20zaak%20"))).toEqual({
      sort: "score",
      direction: "asc",
      query: "zaak",
    });
    expect(readHistoryParams(new URLSearchParams("sort=stars&direction=up"))).toEqual({ sort: "rating", direction: "desc", query: "" });
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

describe("navigation", () => {
  it("has no checker form and no admin in the static site", () => {
    expect(STATIC_NAV_LINKS.map((link) => link.label)).toEqual(["History", "Organisations", "Add your component", "Rating guide", "About"]);
    expect(SERVER_NAV_LINKS.map((link) => link.href)).toContain("/admin");
  });
});
