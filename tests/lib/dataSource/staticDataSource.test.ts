import { describe, expect, it } from "vitest";
import { createStaticDataSource, summaryToAnalysis, type JsonReader } from "@/lib/dataSource/staticDataSource";
import { dataSourceKind } from "@/lib/dataSource/mode";
import { repositoryPath } from "@/lib/staticSite/config";
import { appendToHistory, buildIndexEntry, buildIndexFile, buildLatestFile, type LatestFile } from "@/lib/staticSite/records";
import { publiccodeResult, report } from "../staticSite/fixtures";

const now = new Date("2026-11-19T03:00:00.000Z");

function repository(url: string, users: string[], checkedAts: string[]) {
  const path = repositoryPath(url);
  const dataDir = `repositories/${path.host}/${path.owner}/${path.repo}`;
  let latest: LatestFile | null = null;
  let history = null;
  for (const checkedAt of checkedAts) {
    const next = buildLatestFile(
      {
        path,
        config: { url },
        report: report({ repoUrl: url, owner: path.owner, repo: path.repo, checkedAt, results: [publiccodeResult(users)] }),
        slas: [],
        durationSeconds: 1,
        checkIntervalHours: 24,
      },
      latest
    );
    history = appendToHistory(history, next, latest);
    latest = next;
  }
  const entry = buildIndexEntry(
    { path, dataDir, config: { url, providers: [{ name: "Maykin", services: ["support"] }] }, slas: [], latest, history, lastError: null },
    now
  );
  return { dataDir, latest, history, entry };
}

function source() {
  const zaak = repository("https://github.com/open-zaak/open-zaak", ["Gemeente Utrecht", "Gemeente Den Haag"], [
    "2026-11-18T02:00:00.000Z",
    "2026-11-19T02:00:00.000Z",
  ]);
  const notificaties = repository("https://github.com/open-zaak/open-notificaties", ["gemeente  utrecht"], ["2026-11-19T02:00:00.000Z"]);
  const unscanned = repository("https://github.com/example/unscanned", [], []);
  const files: Record<string, unknown> = {
    "index.json": buildIndexFile([zaak.entry, notificaties.entry, unscanned.entry], "test", now),
  };
  for (const item of [zaak, notificaties]) {
    files[`${item.dataDir}/latest.json`] = item.latest;
    files[`${item.dataDir}/history.json`] = item.history;
  }
  const read: JsonReader = async (relativePath) => (relativePath in files ? structuredClone(files[relativePath]) : null);
  return createStaticDataSource(read);
}

describe("dataSourceKind", () => {
  it("is static only when NEXT_PUBLIC_DATA_SOURCE says so", () => {
    expect(dataSourceKind("static")).toBe("static");
    expect(dataSourceKind(" Static ")).toBe("static");
    expect(dataSourceKind(undefined)).toBe("api");
    expect(dataSourceKind("server")).toBe("api");
  });
});

describe("static data source", () => {
  it("lists scanned repositories and searches them like the backend", async () => {
    const data = source();
    expect((await data.listRepositories()).map((repo) => repo.name)).toEqual(["open-notificaties", "open-zaak"]);
    expect((await data.listRepositories({ q: "NOTIFICATIES" })).map((repo) => repo.name)).toEqual(["open-notificaties"]);
    expect((await data.listRepositories({ q: "zaken" })).map((repo) => repo.name)).toEqual(["open-notificaties", "open-zaak"]);
    expect(await data.listRepositories({ q: "zak" })).toHaveLength(2);
    expect(await data.listRepositories({ limit: 1 })).toHaveLength(1);
  });

  it("gives the latest run in full and older runs as summaries", async () => {
    const history = await source().getRepoHistory("open-zaak", "open-zaak");
    expect(history?.repository).toMatchObject({ id: "github.com/open-zaak/open-zaak", owner: "open-zaak", name: "open-zaak" });
    expect(history?.analyses.map((analysis) => analysis.id)).toEqual(["2026-11-19T02-00-00-000Z", "2026-11-18T02-00-00-000Z"]);
    expect(history?.analyses[0].results).toHaveLength(1);
    expect(history?.analyses[1]).toMatchObject({ results: [], detailAvailable: false, statusCounts: { pass: 1 } });
    expect(history?.extras).toEqual({ basisset: false, providers: [{ name: "Maykin", services: ["support"] }], retired: null });
    expect(await source().getRepoHistory("example", "unscanned")).toBeNull();
    expect(await source().getRepoHistory("nobody", "nothing")).toBeNull();
  });

  it("returns the usage of a repository", async () => {
    expect(await source().getRepositoryUsage("github.com/open-zaak/open-zaak")).toEqual({
      declaredUsers: ["Gemeente Utrecht", "Gemeente Den Haag"],
      declaredUserCount: 2,
      slas: [],
    });
    expect(await source().getRepositoryUsage("missing")).toBeNull();
  });

  it("groups organisations from the declared users and lists their components", async () => {
    const data = source();
    expect((await data.getOrganisations()).organisations).toEqual([
      { name: "Gemeente Den Haag", slug: "gemeente-den-haag", componentCount: 1 },
      { name: "Gemeente Utrecht", slug: "gemeente-utrecht", componentCount: 2 },
    ]);
    const utrecht = await data.getOrganisation("gemeente-utrecht");
    expect(utrecht?.organisation.spellings).toEqual(["Gemeente Utrecht", "gemeente utrecht"]);
    expect(utrecht?.components.map((component) => component.name)).toEqual(["open-notificaties", "open-zaak"]);
    expect(utrecht?.components[0].latestAnalysis?.results).toHaveLength(1);
    expect(await data.getOrganisation("nowhere")).toBeNull();
  });

  it("fails clearly when the index is missing", async () => {
    await expect(createStaticDataSource(async () => null).listRepositories()).rejects.toThrow(/index.json is missing/);
  });
});

describe("summaryToAnalysis", () => {
  it("keeps the verdict and ratings of an older run", () => {
    const analysis = summaryToAnalysis(
      {
        id: "a", checkedAt: "2026-11-18T02:00:00Z", version: "1.0.0", scannedRef: "main", scannedRefKind: "default-branch", scannedCommit: null,
        checklistVersion: null, score: 50, rating: 2.5, categoryRatings: { Security: 2 }, suitable: false, maintained: false,
        statusCounts: { pass: 1, warn: 0, fail: 2, info: 0 }, issueCounts: { errors: 2, warnings: 0 }, declaredUserCount: 0, openDrops: 0,
      },
      "github.com/a/b"
    );
    expect(analysis).toMatchObject({ repoId: "github.com/a/b", rating: 2.5, endorsement: { passed: false, reasons: [] }, aspectRatings: {} });
  });
});
