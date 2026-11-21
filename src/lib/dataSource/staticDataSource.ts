/**
 * Reads the static site's JSON files (see src/lib/staticSite/records.ts) and
 * returns them in the shapes the API returns. It runs at build time only:
 * `next build` with `output: "export"` renders every page from these files.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  OrganisationDetail,
  OrganisationList,
  RepoAnalysisOutput,
  RepoSummary,
  UsageStatus,
} from "@/generated/openapi-client";
import { matchesRepositorySearch } from "@/lib/historySearch";
import { aggregateOrganisations, findNearDuplicates } from "@/lib/staticSite/organisations";
import type { HistoryEntry, HistoryFile, IndexEntry, IndexFile, LatestFile } from "@/lib/staticSite/records";
import type { DataSource, RepoHistory, StaticAnalysisExtras } from "./types";

/** Reads one JSON file relative to the data root; null when it does not exist. */
export type JsonReader = (relativePath: string) => Promise<unknown | null>;

export function fileReader(root: string): JsonReader {
  return async (relativePath) => {
    try {
      return JSON.parse(await readFile(path.join(root, relativePath), "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  };
}

export function dataRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(env.CGC_DATA_DIR || "data");
}

/** An older run as the component page lists it: its summary, without check results. */
export function summaryToAnalysis(entry: HistoryEntry, repoId: string): RepoAnalysisOutput & StaticAnalysisExtras {
  return {
    id: entry.id,
    repoId,
    checkedAt: entry.checkedAt,
    createdAt: entry.checkedAt,
    version: entry.version,
    score: entry.score,
    rating: entry.rating as RepoAnalysisOutput["rating"],
    categoryRatings: entry.categoryRatings as RepoAnalysisOutput["categoryRatings"],
    aspectRatings: {} as RepoAnalysisOutput["aspectRatings"],
    endorsement: { passed: entry.suitable, reasons: [] } as RepoAnalysisOutput["endorsement"],
    issueCounts: entry.issueCounts,
    declaredUserCount: entry.declaredUserCount,
    results: [],
    statusCounts: entry.statusCounts,
    detailAvailable: false,
  };
}

/** RepoHistoryResponse from latest.json and history.json: the latest run in full, older runs as summaries. */
export function toRepoHistory(entry: IndexEntry, latest: LatestFile, history: HistoryFile | null, limit: number): RepoHistory {
  const { repository, analysis } = latest;
  const older = (history?.analyses ?? []).filter((item) => item.id !== analysis.id);
  const analyses = [
    { ...analysis, detailAvailable: true } as unknown as RepoAnalysisOutput,
    ...older.map((item) => summaryToAnalysis(item, repository.id)),
  ].slice(0, limit);
  return {
    repository: {
      id: repository.id,
      repoUrl: repository.repoUrl,
      owner: repository.owner,
      name: repository.name,
      metadata: repository.metadata as RepoHistory["repository"]["metadata"],
      followed: entry.followed,
      checkIntervalHours: entry.checkIntervalHours,
      scanRef: repository.scanRef,
      lastCheckedAt: repository.lastCheckedAt,
      nextCheckAt: null as unknown as string,
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    },
    analyses,
    extras: { basisset: entry.basisset, providers: entry.providers ?? [] },
    maintainedDecision: entry.maintainedDecision ?? null,
  };
}

export function toRepoSummary(entry: IndexEntry): RepoSummary {
  return entry as unknown as RepoSummary;
}

export function toUsageStatus(entry: IndexEntry): UsageStatus {
  return {
    declaredUsers: entry.latestAnalysis ? entry.declaredUsers : (null as unknown as string[]),
    declaredUserCount: entry.latestAnalysis ? entry.declaredUsers.length : (null as unknown as number),
    slas: entry.slas as UsageStatus["slas"],
  };
}

/** Organisations from the declared users of every listed repository. */
export function organisationGroups(index: IndexFile) {
  const followed = index.repositories.filter((entry) => entry.latestAnalysis);
  return aggregateOrganisations(followed.map((entry) => ({ repoId: entry.id, declaredUsers: entry.declaredUsers })));
}

export function toOrganisationList(index: IndexFile): OrganisationList {
  const groups = organisationGroups(index);
  return {
    organisations: groups.map((group) => ({ name: group.name, slug: group.slug, componentCount: group.repoIds.length })),
    nearDuplicates: findNearDuplicates(groups),
  };
}

export function createStaticDataSource(read: JsonReader): DataSource & {
  index(): Promise<IndexFile>;
  latest(entry: IndexEntry): Promise<LatestFile | null>;
} {
  let indexPromise: Promise<IndexFile> | null = null;
  const index = () => {
    indexPromise ??= read("index.json").then((value) => {
      if (!value) throw new Error("data/index.json is missing: run the scan runner (npm run scan:static) first.");
      return value as IndexFile;
    });
    return indexPromise;
  };
  const latest = async (entry: IndexEntry) => (await read(`${entry.path}/latest.json`)) as LatestFile | null;
  const find = async (owner: string, repo: string) =>
    (await index()).repositories.find((entry) => entry.owner === owner && entry.name === repo) ?? null;

  return {
    kind: "static",
    index,
    latest,
    async listRepositories({ limit, q } = {}) {
      // A repository without a successful scan has no page yet, so the index leaves it out.
      const matching = (await index()).repositories.filter(
        (entry) => entry.latestAnalysis && matchesRepositorySearch(entry, q ?? "")
      );
      return (limit ? matching.slice(0, limit) : matching).map(toRepoSummary);
    },
    async getRepoHistory(owner, repo, limit = 50) {
      const entry = await find(owner, repo);
      if (!entry) return null;
      const file = await latest(entry);
      if (!file) return null;
      const history = (await read(`${entry.path}/history.json`)) as HistoryFile | null;
      return toRepoHistory(entry, file, history, limit);
    },
    async getRepositoryUsage(repoId) {
      const entry = (await index()).repositories.find((item) => item.id === repoId);
      return entry ? toUsageStatus(entry) : null;
    },
    async getOrganisations() {
      return toOrganisationList(await index());
    },
    async getOrganisation(slug) {
      const file = await index();
      const group = organisationGroups(file).find((item) => item.slug === slug);
      if (!group) return null;
      const entries = group.repoIds
        .map((id) => file.repositories.find((entry) => entry.id === id))
        .filter((entry): entry is IndexEntry => Boolean(entry))
        .sort((a, b) => `${a.owner}/${a.name}`.toLowerCase().localeCompare(`${b.owner}/${b.name}`.toLowerCase()));
      const components = await Promise.all(
        entries.map(async (entry) => {
          const analysis = (await latest(entry))?.analysis ?? null;
          return {
            repoId: entry.id,
            owner: entry.owner,
            name: entry.name,
            repoUrl: entry.repoUrl,
            slas: entry.slas,
            latestAnalysis: analysis,
          };
        })
      );
      return {
        organisation: { name: group.name, slug: group.slug, spellings: group.spellings, componentCount: group.repoIds.length },
        components,
      } as unknown as OrganisationDetail;
    },
  };
}

let shared: ReturnType<typeof createStaticDataSource> | null = null;

/** The static data source on the data root (CGC_DATA_DIR, default ./data). */
export function staticDataSource() {
  shared ??= createStaticDataSource(fileReader(dataRoot()));
  return shared;
}

/** Route parameters for every component page. */
export async function staticRepositoryParams(): Promise<Array<{ owner: string; repo: string }>> {
  const { repositories } = await staticDataSource().index();
  return repositories.filter((entry) => entry.latestAnalysis).map((entry) => ({ owner: entry.owner, repo: entry.name }));
}

/** Route parameters for the run page of each latest analysis; older runs have no page in the static site. */
export async function staticAnalysisParams(): Promise<Array<{ owner: string; repo: string; analysisId: string }>> {
  const { repositories } = await staticDataSource().index();
  return repositories
    .filter((entry) => entry.latestAnalysis)
    .map((entry) => ({ owner: entry.owner, repo: entry.name, analysisId: entry.latestAnalysis!.id }));
}

export async function staticOrganisationParams(): Promise<Array<{ slug: string }>> {
  return organisationGroups(await staticDataSource().index()).map((group) => ({ slug: group.slug }));
}
