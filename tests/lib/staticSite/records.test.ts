import { describe, expect, it } from "vitest";
import {
  analysisIdFor,
  appendToHistory,
  buildIndexEntry,
  buildIndexFile,
  buildLatestFile,
  statusCounts,
  type ScanInput,
} from "@/lib/staticSite/records";
import { repositoryPath } from "@/lib/staticSite/config";
import { report, result } from "./fixtures";

const path = repositoryPath("https://github.com/open-zaak/open-zaak");
const sla = { repository: "https://github.com/open-zaak/open-zaak", party: "VNG", maintainer: "Maykin", start: "2026-01-01", until: "2026-12-31" };

function input(overrides: Partial<ScanInput> = {}): ScanInput {
  return {
    path,
    config: { url: "https://github.com/open-zaak/open-zaak", basisset: true, hints: { helm: ["charts"] } },
    report: report(),
    slas: [sla],
    minUsers: 1,
    durationSeconds: 12.3,
    checkIntervalHours: 24,
    ...overrides,
  };
}

describe("analysisIdFor", () => {
  it("makes a file-name-safe id from the time", () => {
    expect(analysisIdFor("2026-11-19T02:00:00.123Z")).toBe("2026-11-19T02-00-00-123Z");
  });
});

describe("statusCounts", () => {
  it("counts each status", () => {
    expect(statusCounts([{ status: "pass" }, { status: "pass" }, { status: "fail" }, { status: "info" }])).toEqual({ pass: 2, warn: 0, fail: 1, info: 1 });
  });
});

describe("buildLatestFile", () => {
  it("holds the repository and the analysis in the API shapes, with the Maintained level", () => {
    const latest = buildLatestFile(input(), null);
    expect(latest.repository).toMatchObject({
      id: "github.com/open-zaak/open-zaak",
      owner: "open-zaak",
      name: "open-zaak",
      followed: true,
      basisset: true,
      createdAt: "2026-11-19T02:00:00.000Z",
      providers: [],
    });
    expect(latest.analysis).toMatchObject({
      id: "2026-11-19T02-00-00-000Z",
      repoId: "github.com/open-zaak/open-zaak",
      version: "1.31.2",
      scannedRef: "main",
      scannedRefKind: "default-branch",
      checklistVersion: "2026.1",
      declaredUsers: ["Gemeente Utrecht", "Gemeente Den Haag"],
      declaredUserCount: 2,
      maintained: true,
      issueCounts: { errors: 0, warnings: 1 },
      durationSeconds: 12.3,
    });
    expect(latest.slas).toEqual([{ id: "sla-1", party: "VNG", maintainer: "Maykin", startsOn: "2026-01-01", until: "2026-12-31", link: null }]);
  });

  it("takes the scanned ref and checklist version from the report when the checker gives them", () => {
    const latest = buildLatestFile(
      input({ report: { ...report(), scannedRef: "v1.31.2", scannedRefKind: "release", scannedCommit: "abc", checklistVersion: "2026.1" } }),
      null
    );
    expect(latest.analysis).toMatchObject({ scannedRef: "v1.31.2", scannedRefKind: "release", scannedCommit: "abc", checklistVersion: "2026.1" });
  });

  it("keeps how the scan ran, so the next run can reuse the code checks", () => {
    const latest = buildLatestFile(
      input({
        report: {
          ...report(),
          scanMode: "partial",
          scanModeReason: "the code did not change",
          toolFingerprint: "sha256:tools",
          inputsFingerprint: "sha256:inputs",
        },
      }),
      null
    );
    expect(latest.analysis).toMatchObject({
      scanMode: "partial",
      scanModeReason: "the code did not change",
      toolFingerprint: "sha256:tools",
      inputsFingerprint: "sha256:inputs",
      durationSeconds: 12.3,
    });
    expect(appendToHistory(null, latest, null).analyses[0]).toMatchObject({ scanMode: "partial", durationSeconds: 12.3 });
    expect(buildLatestFile(input(), null).analysis).toMatchObject({ scanMode: null, toolFingerprint: null });
  });

  it("is not Maintained without a valid SLA, and keeps the creation time of the previous file", () => {
    const first = buildLatestFile(input(), null);
    const later = buildLatestFile(input({ slas: [], report: report({ checkedAt: "2026-11-20T02:00:00.000Z" }) }), first);
    expect(later.analysis.maintained).toBe(false);
    expect(later.repository.createdAt).toBe("2026-11-19T02:00:00.000Z");
  });
});

describe("appendToHistory", () => {
  it("puts the newest summary first, without results, and records drops", () => {
    const withVersion = (checkedAt: string, results = report().results) =>
      buildLatestFile(input({ report: { ...report({ checkedAt, results }), scannedRefKind: "release", checklistVersion: "2026.1" } }), null);
    const first = withVersion("2026-11-18T02:00:00.000Z");
    const history1 = appendToHistory(null, first, null);
    const second = withVersion("2026-11-19T02:00:00.000Z", [...report().results.slice(0, 1), result("license", "fail")]);
    const history2 = appendToHistory(history1, second, first);

    expect(history2.analyses.map((entry) => entry.id)).toEqual([second.analysis.id, first.analysis.id]);
    expect(history2.analyses[0]).toMatchObject({ suitable: true, statusCounts: { pass: 1, warn: 0, fail: 1, info: 0 }, openDrops: 1 });
    expect(history2.analyses[0]).not.toHaveProperty("results");
    expect(history2.drops).toHaveLength(1);
    expect(history2.drops[0]).toMatchObject({ kind: "criterion", subject: "license" });
  });

  it("replaces an entry of the same analysis instead of adding it twice", () => {
    const latest = buildLatestFile(input(), null);
    const history = appendToHistory(appendToHistory(null, latest, null), latest, null);
    expect(history.analyses).toHaveLength(1);
  });
});

describe("buildIndexEntry and buildIndexFile", () => {
  const now = new Date("2026-11-19T03:00:00.000Z");

  it("lists a scanned repository with its latest analysis, users, SLAs, providers and drops", () => {
    const latest = buildLatestFile(input(), null);
    const providers = [{ name: "Maykin", services: ["maintenance" as const] }];
    const entry = buildIndexEntry(
      {
        path,
        dataDir: "repositories/github.com/open-zaak/open-zaak",
        config: { url: "https://github.com/open-zaak/open-zaak", basisset: true, providers, hints: { helm: ["charts"] } },
        slas: [sla],
        latest,
        history: {
          ...appendToHistory(null, latest, null),
          drops: [
            {
              id: "d1", analysisId: "x", previousAnalysisId: "w", scannedRefKind: "release", checklistVersion: "2026.1",
              kind: "verdict", subject: "suitable", label: "Suitable", from: "suitable", to: "not suitable",
              detectedAt: "2026-10-01T00:00:00Z", fixTermDays: 30, fixBy: "2026-10-31T00:00:00Z", resolvedAt: null, resolvedAnalysisId: null,
            },
          ],
        },
        lastError: null,
      },
      now
    );
    expect(entry).toMatchObject({
      id: "github.com/open-zaak/open-zaak",
      displayName: "Open Zaak",
      helmChartLocations: ["charts"],
      analysisCount: 1,
      basisset: true,
      providers,
      declaredUsers: ["Gemeente Utrecht", "Gemeente Den Haag"],
      openDropCount: 1,
      overdueDropCount: 1,
      lastError: null,
    });
    expect(entry.latestAnalysis).toMatchObject({ score: 70, rating: 3.6, maintained: true, scannedRefKind: "default-branch" });
    expect(entry.latestAnalysis).not.toHaveProperty("results");
  });

  it("lists the functionalities of the component list and the evidence of the standards result", () => {
    const evidence = ["Found in the repository, not declared: Zaken API 1.5.1 in src/openapi.yaml (by title)"];
    const config = {
      url: "https://github.com/open-zaak/open-zaak",
      functionalities: ["registreren-en-delen-van-zaken"],
      functionalitiesDraft: true,
    };
    const latest = buildLatestFile(
      input({ config, report: report({ results: [result("standards", "info", { evidence })] }) }),
      null
    );
    expect(latest.repository).toMatchObject({ functionalities: ["registreren-en-delen-van-zaken"], functionalitiesDraft: true });
    const entry = buildIndexEntry(
      { path, dataDir: "", config, slas: [], latest, history: null, lastError: null },
      now
    );
    expect(entry).toMatchObject({ functionalities: ["registreren-en-delen-van-zaken"], functionalitiesDraft: true });
    expect(entry.latestAnalysis?.standardsEvidence).toEqual(evidence);

    const withoutStandards = buildIndexEntry(
      { path, dataDir: "", config: { url: config.url }, slas: [], latest: buildLatestFile(input(), null), history: null, lastError: null },
      now
    );
    expect(withoutStandards).toMatchObject({ functionalities: [], functionalitiesDraft: false });
    expect(withoutStandards.latestAnalysis?.standardsEvidence).toBeNull();
  });

  it("lists a repository without a scan, and a retired one as not followed", () => {
    const entry = buildIndexEntry(
      {
        path,
        dataDir: "repositories/github.com/open-zaak/open-zaak",
        config: { url: "https://github.com/open-zaak/open-zaak", retired: { on: "2026-10-01", reason: "Archived" } },
        slas: [],
        latest: null,
        history: null,
        lastError: "The scan of x did not finish within 45 minutes",
      },
      now
    );
    expect(entry).toMatchObject({ followed: false, latestAnalysis: null, analysisCount: 0, retired: { reason: "Archived" } });
    expect(entry.lastError).toMatch(/45 minutes/);
  });

  it("sorts the index by owner and name", () => {
    const make = (url: string) =>
      buildIndexEntry({ path: repositoryPath(url), dataDir: "", config: { url }, slas: [], latest: null, history: null, lastError: null }, now);
    const file = buildIndexFile([make("https://github.com/open-zaak/open-zaak"), make("https://github.com/ConductionNL/opencatalogi")], "0.0.2+abc", now);
    expect(file.repositories.map((entry) => entry.name)).toEqual(["opencatalogi", "open-zaak"]);
    expect(file).toMatchObject({ schemaVersion: 1, generatedAt: "2026-11-19T03:00:00.000Z", checkerVersion: "0.0.2+abc" });
  });
});
