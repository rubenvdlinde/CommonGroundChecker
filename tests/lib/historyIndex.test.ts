import { describe, expect, it } from "vitest";
import type { RepoSummary } from "@/generated/openapi-client";
import { parseBasisset, type Basisset } from "@/lib/basisset";
import {
  buildHistoryIndex,
  matchesFilter,
  parseHistoryFilter,
  statusCounts,
  toHistoryIndexEntry,
} from "@/lib/historyIndex";
import { buildHistoryHref } from "@/lib/historySearch";

const basisset = parseBasisset({
  version: "0.3.1",
  components: [
    { name: "OpenZaak", status: "g", basisset: true, repo: ["https://github.com/open-zaak/open-zaak"], version: "1.29.0" },
    { name: "OpenFormulieren", status: "g", basisset: false, repo: ["https://github.com/open-formulieren/open-forms"], version: "4.1.0" },
  ],
}) as Basisset;

const options = { basisset, minUsers: 1, today: "2026-11-19" };
const validSla = { id: "s1", party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31", link: null };

/** A repository as GET /api/repositories gives it; the static index entry has the same fields. */
function summary(name: string, fields: Record<string, unknown> = {}, latest: Record<string, unknown> | null = {}): RepoSummary {
  return {
    id: name,
    owner: name,
    name,
    repoUrl: `https://github.com/${name}/${name}`,
    analysisCount: latest ? 1 : 0,
    latestAnalysis: latest && {
      checkedAt: "2026-11-19T10:00:00Z",
      score: 80,
      rating: 3.6,
      endorsement: { passed: true, reasons: [] },
      version: "1.31.2",
      declaredUserCount: 3,
      developmentStatus: "stable",
      ...latest,
    },
    slas: [validSla],
    ...fields,
  } as unknown as RepoSummary;
}

const repositories = [
  summary("open-zaak", { repoUrl: "https://github.com/open-zaak/open-zaak" }),
  summary("open-forms", { repoUrl: "https://github.com/open-formulieren/open-forms", slas: [] }),
  summary("measured", {}, { endorsement: { passed: false, reasons: ["Overall rating below 2.5"] }, rating: 2.1 }),
  summary("listed", {}, null),
  summary("old", { retiredAt: "2026-11-01T00:00:00Z", retiredReason: "Replaced" }),
  summary("dropping", { openDropCount: 1, overdueDropCount: 0, nextFixBy: "2026-11-26T12:00:00Z" }, {
    endorsement: { passed: false, reasons: ["Overall rating below 2.5"] },
  }),
];

describe("toHistoryIndexEntry", () => {
  it("adds the status, the basisset match, the rating, the verdict and the version to the summary", () => {
    const entry = toHistoryIndexEntry(repositories[0], options);
    expect(entry.id).toBe("open-zaak");
    expect(entry.lifecycle.status).toBe("maintained");
    expect(entry.basisset.entries).toEqual([
      { name: "OpenZaak", status: "g", version: "1.29.0", inBasisset: true, comparison: "newer" },
    ]);
    expect(entry.rating).toBe(3.6);
    expect(entry.verdict).toBe(true);
    expect(entry.version).toBe("1.31.2");
    expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
  });

  it("gives every status from the fields of the list", () => {
    expect(buildHistoryIndex(repositories, options).map((entry) => [entry.name, entry.lifecycle.status])).toEqual([
      ["open-zaak", "maintained"],
      ["open-forms", "suitable"],
      ["measured", "measured"],
      ["listed", "listed"],
      ["old", "retired"],
      ["dropping", "maintained"],
    ]);
    expect(toHistoryIndexEntry(repositories[5], options).lifecycle.note).toBe("Open drop, fix by 26-11-2026");
  });

  it("takes developmentStatus from the summary when the analysis has none", () => {
    const entry = toHistoryIndexEntry(
      summary("x", { developmentStatus: "obsolete" }, { developmentStatus: undefined }),
      options
    );
    expect(entry.lifecycle.status).toBe("retired");
  });

  it("has no rating, verdict or version without an analysis, and no basisset match without the list", () => {
    const entry = toHistoryIndexEntry(repositories[3], { ...options, basisset: null });
    expect([entry.rating, entry.verdict, entry.version]).toEqual([null, null, null]);
    expect(entry.basisset.available).toBe(false);
  });
});

describe("History filter", () => {
  it("reads the status and basisset from the URL, ignoring an unknown status", () => {
    expect(parseHistoryFilter("Maintained", "1")).toEqual({ status: "maintained", basisset: true });
    expect(parseHistoryFilter("approved", undefined)).toEqual({ status: null, basisset: false });
    expect(parseHistoryFilter(undefined, "true")).toEqual({ status: null, basisset: true });
    expect(parseHistoryFilter(undefined, "0")).toEqual({ status: null, basisset: false });
  });

  it("puts the filter in the URL next to the search and the sort", () => {
    expect(buildHistoryHref({ q: "zaak", sort: "rating", direction: "desc", status: "maintained", basisset: true })).toBe(
      "/history?sort=rating&direction=desc&q=zaak&status=maintained&basisset=1"
    );
    expect(buildHistoryHref({ sort: "date", direction: "asc", status: null, basisset: false })).toBe(
      "/history?sort=date&direction=asc"
    );
  });

  it("keeps the entries with the status, and only basisset entries when asked", () => {
    const entries = buildHistoryIndex(repositories, options);
    const names = (filter: Parameters<typeof matchesFilter>[1]) =>
      entries.filter((entry) => matchesFilter(entry, filter)).map((entry) => entry.name);
    expect(names({ status: null, basisset: false })).toHaveLength(6);
    expect(names({ status: "maintained", basisset: false })).toEqual(["open-zaak", "dropping"]);
    expect(names({ status: null, basisset: true })).toEqual(["open-zaak"]);
    expect(names({ status: "suitable", basisset: true })).toEqual([]);
  });

  it("counts every status, and counts within the basisset when that filter is on", () => {
    const entries = buildHistoryIndex(repositories, options);
    expect(statusCounts(entries, false)).toEqual({
      all: 6,
      byStatus: { listed: 1, measured: 1, suitable: 1, maintained: 2, retired: 1 },
      basisset: 1,
    });
    expect(statusCounts(entries, true)).toEqual({
      all: 1,
      byStatus: { listed: 0, measured: 0, suitable: 0, maintained: 1, retired: 0 },
      basisset: 1,
    });
  });
});
