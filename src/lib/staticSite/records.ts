/**
 * The data files of the static site, and how a scan turns into them.
 *
 *   data/index.json                                         one entry per followed repository
 *   data/repositories/<host>/<owner>/<repo>/latest.json      the latest analysis in full
 *   data/repositories/<host>/<owner>/<repo>/history.json     a small summary per analysis, and the drops
 *
 * latest.json holds the repository and its analysis in the shapes the API
 * returns, so pages read both sources the same way. history.json stays small:
 * no check results, no evidence, no aspect ratings.
 */
import { countIssues } from "@/lib/issues";
import { adoptionFactsOf, withAdoptionConditions } from "@/lib/ratings";
import { computeMaintained, declaredUsersOf, developmentStatusOf } from "@/lib/maintained";
import type { CheckReport, CheckStatus } from "@/lib/types";
import { repositoryId, type FollowedRepository, type RepositoryPath, type MaintainedDecision, type ServiceProvider, type SlaEntry } from "./config";
import { isOverdue, snapshotOf, updateDrops, type DropRecord, type FixTerms, type ScannedAnalysis } from "./drops";

export const DATA_SCHEMA_VERSION = 1;

/** The ref a scan read; filled from the report when the checker resolves refs, else the default branch. */
export interface ScannedRef {
  scannedRef: string | null;
  scannedRefKind: string | null;
  scannedCommit: string | null;
}

export interface StaticSla {
  id: string;
  party: string;
  maintainer: string;
  startsOn: string;
  until: string;
  link: string | null;
}

export interface LatestRepository {
  id: string;
  repoUrl: string;
  host: string;
  owner: string;
  name: string;
  metadata: CheckReport["repoMeta"];
  followed: boolean;
  checkIntervalHours: number;
  lastCheckedAt: string;
  nextCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
  basisset: boolean;
  scanRef: string | null;
  isRegister: boolean;
  slaLabels: string[];
  /** VNG's decision to take the component into management; absent in files written before it existed */
  maintainedDecision?: MaintainedDecision | null;
  providers: ServiceProvider[];
  /** Ids of config/functionalities.yml */
  functionalities: string[];
  functionalitiesDraft: boolean;
}

export interface LatestAnalysis extends ScannedRef {
  id: string;
  repoId: string;
  scoringConfigId: string | null;
  checkedAt: string;
  createdAt: string;
  version: string | null;
  checklistVersion: string | null;
  score: number;
  rating: number | null;
  categoryRatings: CheckReport["categoryRatings"];
  aspectRatings: CheckReport["aspectRatings"];
  endorsement: CheckReport["endorsement"];
  issueCounts: { errors: number; warnings: number };
  declaredUsers: string[];
  declaredUserCount: number;
  maintained: boolean;
  results: CheckReport["results"];
  durationSeconds: number | null;
  /** Absent in files written before scans could be partial */
  scanMode?: CheckReport["scanMode"] | null;
  scanModeReason?: string | null;
  toolFingerprint?: string | null;
  inputsFingerprint?: string | null;
}

export interface LatestFile {
  schemaVersion: number;
  repository: LatestRepository;
  analysis: LatestAnalysis;
  slas: StaticSla[];
}

export interface StatusCounts {
  pass: number;
  warn: number;
  fail: number;
  info: number;
}

export interface HistoryEntry extends ScannedRef {
  id: string;
  checkedAt: string;
  version: string | null;
  checklistVersion: string | null;
  score: number;
  rating: number | null;
  categoryRatings: Record<string, number | null>;
  /** The verdict "suitable for Common Ground" */
  suitable: boolean;
  maintained: boolean;
  statusCounts: StatusCounts;
  issueCounts: { errors: number; warnings: number };
  declaredUserCount: number;
  /** Drops still open right after this analysis */
  openDrops: number;
  scanMode?: CheckReport["scanMode"] | null;
  durationSeconds?: number | null;
}

export interface HistoryFile {
  schemaVersion: number;
  repoId: string;
  /** Newest first */
  analyses: HistoryEntry[];
  /** Newest first, open and resolved */
  drops: DropRecord[];
}

export interface IndexLatestAnalysis extends ScannedRef {
  id: string;
  checkedAt: string;
  score: number;
  rating: number | null;
  categoryRatings: Record<string, number | null>;
  endorsement: CheckReport["endorsement"];
  issueCounts: { errors: number; warnings: number };
  version: string | null;
  checklistVersion: string | null;
  /** `developmentStatus` of the scanned publiccode.yml, or null */
  developmentStatus: string | null;
  /** Organisations under `usedBy` in the scanned publiccode.yml */
  declaredUserCount: number;
  maintained: boolean;
  /** Evidence of the "Supported standards" result; null when the analysis has none */
  standardsEvidence: string[] | null;
}

/** One repository in index.json: the fields of GET /api/repositories, plus what the static site adds. */
export interface IndexEntry {
  id: string;
  host: string;
  owner: string;
  name: string;
  repoUrl: string;
  /** Data directory under the data root */
  path: string;
  helmChartLocations: string[];
  dockerLocations: string[];
  apiSpecificationLocations: string[];
  documentationLocations: string[];
  displayName: string | null;
  shortDescription: string | null;
  logoUrl: string | null;
  developmentStatus: string | null;
  maintenanceType: string | null;
  maintainers: string[];
  topics: string[];
  description: string | null;
  updatedAt: string;
  followed: boolean;
  checkIntervalHours: number;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  analysisCount: number;
  latestAnalysis: IndexLatestAnalysis | null;
  basisset: boolean;
  scanRef: string | null;
  isRegister: boolean;
  slaLabels: string[];
  /** VNG's decision to take the component into management; absent in files written before it existed */
  maintainedDecision?: MaintainedDecision | null;
  providers: ServiceProvider[];
  /** Ids of config/functionalities.yml */
  functionalities: string[];
  /** True while the component owner has not confirmed the functionalities */
  functionalitiesDraft: boolean;
  declaredUsers: string[];
  slas: StaticSla[];
  openDropCount: number;
  overdueDropCount: number;
  /** The last scan failed; the entry shows the analysis before it */
  lastError: string | null;
}

export interface IndexFile {
  schemaVersion: number;
  generatedAt: string;
  checkerVersion: string;
  repositories: IndexEntry[];
}

/** A file-name-safe id for an analysis, from its time: 2026-11-19T03-00-12-345Z. */
export function analysisIdFor(checkedAt: string): string {
  return checkedAt.replace(/[:.]/g, "-");
}

export function statusCounts(results: Array<{ status: CheckStatus | string }>): StatusCounts {
  const counts: StatusCounts = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const result of results) {
    if (result.status in counts) counts[result.status as keyof StatusCounts] += 1;
  }
  return counts;
}

export function toStaticSlas(slas: SlaEntry[]): StaticSla[] {
  return slas
    .map((sla, index) => ({
      id: `sla-${index + 1}`,
      party: sla.party,
      maintainer: sla.maintainer,
      startsOn: sla.start,
      until: sla.until,
      link: sla.link ?? null,
    }))
    .sort((a, b) => b.until.localeCompare(a.until));
}

export interface ScanInput {
  path: RepositoryPath;
  config: FollowedRepository;
  report: CheckReport & Partial<ScannedRef> & { checklistVersion?: string | null };
  slas: SlaEntry[];
  durationSeconds: number | null;
  /** Scheduled interval of the static site, in hours */
  checkIntervalHours: number;
}

/** The latest.json of a scan. `previous` keeps the creation time of the repository. */
export function buildLatestFile(input: ScanInput, previous: LatestFile | null): LatestFile {
  const { report, path, config } = input;
  const id = repositoryId(path);
  const slas = toStaticSlas(input.slas);
  const declaredUsers = declaredUsersOf(report.results);
  const maintained = computeMaintained({
    endorsement: report.endorsement,
    decision: config.maintained ?? null,
    slas,
    today: report.checkedAt.slice(0, 10),
  }).maintained;
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    repository: {
      id,
      repoUrl: report.repoUrl,
      host: path.host,
      owner: path.owner,
      name: path.repo,
      metadata: report.repoMeta,
      followed: true,
      checkIntervalHours: input.checkIntervalHours,
      lastCheckedAt: report.checkedAt,
      nextCheckAt: null,
      createdAt: previous?.repository.createdAt ?? report.checkedAt,
      updatedAt: report.checkedAt,
      basisset: config.basisset === true,
      scanRef: config.scanRef ?? null,
      isRegister: config.register === true,
      slaLabels: config.slaLabels ?? [],
      maintainedDecision: config.maintained ?? null,
      providers: config.providers ?? [],
      functionalities: config.functionalities ?? [],
      functionalitiesDraft: config.functionalitiesDraft === true,
    },
    analysis: {
      id: analysisIdFor(report.checkedAt),
      repoId: id,
      scoringConfigId: report.scoringConfigId,
      checkedAt: report.checkedAt,
      createdAt: report.checkedAt,
      version: report.repoMeta.version,
      checklistVersion: report.checklistVersion ?? null,
      scannedRef: report.scannedRef ?? report.repoMeta.defaultBranch,
      scannedRefKind: report.scannedRefKind ?? "default-branch",
      scannedCommit: report.scannedCommit ?? null,
      score: report.score,
      rating: report.rating,
      categoryRatings: report.categoryRatings,
      aspectRatings: report.aspectRatings,
      endorsement: report.endorsement,
      issueCounts: countIssues(report.results, report.rating, report.endorsement),
      declaredUsers,
      declaredUserCount: declaredUsers.length,
      maintained,
      results: report.results,
      durationSeconds: input.durationSeconds,
      scanMode: report.scanMode ?? null,
      scanModeReason: report.scanModeReason ?? null,
      toolFingerprint: report.toolFingerprint ?? null,
      inputsFingerprint: report.inputsFingerprint ?? null,
    },
    slas,
  };
}

function scannedAnalysis(analysis: LatestAnalysis): ScannedAnalysis {
  return {
    id: analysis.id,
    checkedAt: analysis.checkedAt,
    scannedRefKind: analysis.scannedRefKind,
    checklistVersion: analysis.checklistVersion,
    snapshot: snapshotOf(analysis),
  };
}

/** The history after a new analysis: its summary first, drops updated against the previous latest analysis. */
export function appendToHistory(
  history: HistoryFile | null,
  latest: LatestFile,
  previous: LatestFile | null,
  terms?: FixTerms
): HistoryFile {
  const { analysis } = latest;
  const { drops } = updateDrops(
    history?.drops ?? [],
    previous ? scannedAnalysis(previous.analysis) : null,
    scannedAnalysis(analysis),
    terms
  );
  const entry: HistoryEntry = {
    id: analysis.id,
    checkedAt: analysis.checkedAt,
    version: analysis.version,
    scannedRef: analysis.scannedRef,
    scannedRefKind: analysis.scannedRefKind,
    scannedCommit: analysis.scannedCommit,
    checklistVersion: analysis.checklistVersion,
    score: analysis.score,
    rating: analysis.rating,
    categoryRatings: analysis.categoryRatings,
    suitable: analysis.endorsement.passed,
    maintained: analysis.maintained,
    statusCounts: statusCounts(analysis.results),
    issueCounts: analysis.issueCounts,
    declaredUserCount: analysis.declaredUserCount,
    openDrops: drops.filter((drop) => drop.resolvedAt === null).length,
    scanMode: analysis.scanMode ?? null,
    durationSeconds: analysis.durationSeconds,
  };
  const earlier = (history?.analyses ?? []).filter((item) => item.id !== entry.id);
  return { schemaVersion: DATA_SCHEMA_VERSION, repoId: latest.repository.id, analyses: [entry, ...earlier], drops };
}

/** The evidence of the "Supported standards" result, which the Components filter reads; null without that result. */
export function standardsEvidenceOf(results: Array<{ id: string; evidence?: string[] }>): string[] | null {
  const result = results.find((item) => item.id === "standards");
  return result ? [...(result.evidence ?? [])] : null;
}

export interface IndexSource {
  path: RepositoryPath;
  dataDir: string;
  config: FollowedRepository;
  slas: SlaEntry[];
  latest: LatestFile | null;
  history: HistoryFile | null;
  lastError: string | null;
}

/** The index.json entry of a repository; one without a successful scan yet is listed without analysis. */
export function buildIndexEntry(source: IndexSource, now: Date): IndexEntry {
  const { latest, history, config, path } = source;
  const meta = latest?.repository.metadata;
  const analysis = latest?.analysis;
  const drops = history?.drops ?? [];
  const open = drops.filter((drop) => drop.resolvedAt === null);
  return {
    id: repositoryId(path),
    host: path.host,
    owner: path.owner,
    name: path.repo,
    repoUrl: latest?.repository.repoUrl ?? config.url,
    path: source.dataDir,
    helmChartLocations: config.hints?.helm ?? [],
    dockerLocations: config.hints?.docker ?? [],
    apiSpecificationLocations: config.hints?.apiSpecs ?? [],
    documentationLocations: config.hints?.docs ?? [],
    displayName: meta?.displayName ?? null,
    shortDescription: meta?.shortDescription ?? null,
    logoUrl: meta?.logoUrl ?? null,
    developmentStatus: meta?.developmentStatus ?? null,
    maintenanceType: meta?.maintenanceType ?? null,
    maintainers: meta?.maintainers ?? [],
    topics: meta?.topics ?? [],
    description: meta?.description ?? null,
    updatedAt: latest?.repository.updatedAt ?? now.toISOString(),
    followed: true,
    checkIntervalHours: latest?.repository.checkIntervalHours ?? 24,
    lastCheckedAt: analysis?.checkedAt ?? null,
    nextCheckAt: null,
    analysisCount: history?.analyses.length ?? 0,
    latestAnalysis: analysis
      ? {
          id: analysis.id,
          checkedAt: analysis.checkedAt,
          score: analysis.score,
          rating: analysis.rating,
          categoryRatings: analysis.categoryRatings,
          endorsement: withAdoptionConditions(analysis.endorsement, adoptionFactsOf(analysis.results)),
          issueCounts: analysis.issueCounts,
          developmentStatus: developmentStatusOf(analysis.results),
          declaredUserCount: analysis.declaredUserCount,
          version: analysis.version,
          checklistVersion: analysis.checklistVersion,
          scannedRef: analysis.scannedRef,
          scannedRefKind: analysis.scannedRefKind,
          scannedCommit: analysis.scannedCommit,
          maintained: analysis.maintained,
          standardsEvidence: standardsEvidenceOf(analysis.results),
        }
      : null,
    basisset: config.basisset === true,
    scanRef: config.scanRef ?? null,
    isRegister: config.register === true,
    slaLabels: config.slaLabels ?? [],
    maintainedDecision: config.maintained ?? null,
    providers: config.providers ?? [],
    functionalities: config.functionalities ?? [],
    functionalitiesDraft: config.functionalitiesDraft === true,
    declaredUsers: analysis?.declaredUsers ?? [],
    slas: toStaticSlas(source.slas),
    openDropCount: open.length,
    overdueDropCount: open.filter((drop) => isOverdue(drop, now)).length,
    lastError: source.lastError,
  };
}

/** Repositories in the order of the Components index default: name, case-insensitive. */
export function buildIndexFile(entries: IndexEntry[], checkerVersion: string, now: Date): IndexFile {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    checkerVersion,
    repositories: [...entries].sort((a, b) =>
      `${a.owner}/${a.name}`.toLowerCase().localeCompare(`${b.owner}/${b.name}`.toLowerCase())
    ),
  };
}
