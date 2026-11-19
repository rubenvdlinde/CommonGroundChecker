import { criterionRating } from "@/lib/ratings";
import { describe, expect, it } from "vitest";
import {
  CRITERION_FRESHNESS_BY_CHECK_ID,
  DEFAULT_CRITERION_CONFIG_BY_CHECK_ID,
  criterionFreshness,
} from "@/lib/checkers/config";
import { RESULT_ORDER_BY_ID } from "@/lib/criteria";
import {
  DEFAULT_FULL_SCAN_INTERVAL_DAYS,
  decideScanMode,
  inputsFingerprint,
  lastMeasuredAt,
  readFullScanIntervalDays,
  reuseResult,
  toPreviousAnalysis,
  type PreviousAnalysis,
  type ScanModeInput,
} from "@/lib/incremental";
import type { CheckResult } from "@/lib/types";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const OTHER_COMMIT = "fedcba9876543210fedcba9876543210fedcba98";
const NOW = new Date("2026-11-19T02:00:00Z");

function result(id: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { id, title: id, description: "", status: "pass", message: `${id} pass`, requirementLevel: "mandatory", ...extra };
}

function previous(overrides: Partial<PreviousAnalysis> = {}): PreviousAnalysis {
  return {
    id: "analysis-1",
    checkedAt: "2026-11-18T02:00:00Z",
    scannedCommit: COMMIT,
    checklistVersion: "2026.1",
    toolFingerprint: "sha256:tools",
    inputsFingerprint: "sha256:inputs",
    results: [result("complexity"), result("docker"), result("dockerimage"), result("usage"), result("maintenance")],
    ...overrides,
  };
}

function input(overrides: Partial<ScanModeInput> = {}): ScanModeInput {
  return {
    previous: previous(),
    commit: COMMIT,
    checklistVersion: "2026.1",
    toolFingerprint: "sha256:tools",
    inputsFingerprint: "sha256:inputs",
    now: NOW,
    fullScanIntervalDays: 7,
    ...overrides,
  };
}

describe("criterion freshness", () => {
  it("classes every criterion explicitly", () => {
    const ids = new Set([...Object.keys(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID), ...RESULT_ORDER_BY_ID]);
    const missing = [...ids].filter((id) => !(id in CRITERION_FRESHNESS_BY_CHECK_ID));
    expect(missing).toEqual([]);
  });

  it("measures the outside-world criteria on every run", () => {
    for (const id of ["dockerimage", "usage", "maintenance", "semver", "opensourcehealth", "openssfscorecard", "projecthealth", "artifacthub"]) {
      expect(criterionFreshness(id)).toBe("per-run");
    }
    for (const id of ["complexity", "maintainability", "duplication", "coupling", "size", "owaspsecurecoding", "secretscanning", "publiccode", "docker", "helmchart", "documentation", "tests", "spdxheaders"]) {
      expect(criterionFreshness(id)).toBe("per-commit");
    }
  });

  it("classes an unknown criterion per-run", () => {
    expect(criterionFreshness("a-criterion-added-later")).toBe("per-run");
  });
});

describe("decideScanMode", () => {
  it("reuses the per-commit results of the same commit, checklist, tools and settings", () => {
    const decision = decideScanMode(input());

    expect(decision.mode).toBe("partial");
    expect(decision.reason).toBe("the code did not change");
    expect([...decision.reused.keys()].sort()).toEqual(["complexity", "docker"]);
    expect(decision.reused.get("complexity")?.reusedFrom).toEqual({
      analysisId: "analysis-1",
      checkedAt: "2026-11-18T02:00:00Z",
      commit: COMMIT,
    });
  });

  it.each([
    ["the commit changed", { commit: OTHER_COMMIT }, "the code changed"],
    ["the commit is not known", { commit: null }, "the scanned commit is not known"],
    ["the checklist version changed", { checklistVersion: "2026.2" }, "the checklist version changed"],
    ["the tools changed", { toolFingerprint: "sha256:newtools" }, "the checker or its tools changed"],
    ["the scan settings changed", { inputsFingerprint: "sha256:otherinputs" }, "the scan settings changed"],
    ["a full scan was asked for", { full: true }, "a full scan was asked for"],
    ["there is no previous analysis", { previous: null }, "there is no previous analysis"],
  ])("scans fully when %s", (_label, overrides, reason) => {
    const decision = decideScanMode(input(overrides as Partial<ScanModeInput>));
    expect(decision).toEqual({ mode: "full", reason, reused: new Map() });
  });

  it("scans fully when the previous analysis predates fingerprints", () => {
    expect(decideScanMode(input({ previous: previous({ toolFingerprint: null }) })).mode).toBe("full");
    expect(decideScanMode(input({ previous: previous({ scannedCommit: null }) })).mode).toBe("full");
  });

  it("scans fully when the code checks were measured the interval or longer ago", () => {
    const sixDays = previous({ checkedAt: "2026-11-13T03:00:00Z" });
    const sevenDays = previous({ checkedAt: "2026-11-12T02:00:00Z" });

    expect(decideScanMode(input({ previous: sixDays })).mode).toBe("partial");
    expect(decideScanMode(input({ previous: sevenDays }))).toMatchObject({
      mode: "full",
      reason: "the code checks are 7 days or more old",
    });
    expect(decideScanMode(input({ previous: sixDays, fullScanIntervalDays: 3 })).mode).toBe("full");
  });

  it("counts the interval from the scan that measured the code checks, not from the last partial scan", () => {
    const measured = { analysisId: "analysis-0", checkedAt: "2026-11-11T02:00:00Z", commit: COMMIT };
    const partialYesterday = previous({
      results: [result("complexity", { reusedFrom: measured }), result("usage")],
    });

    expect(lastMeasuredAt(partialYesterday)).toBe("2026-11-11T02:00:00Z");
    expect(decideScanMode(input({ previous: partialYesterday })).mode).toBe("full");
    const decision = decideScanMode(input({ previous: partialYesterday, fullScanIntervalDays: 30 }));
    expect(decision.reused.get("complexity")?.reusedFrom).toEqual(measured);
  });

  it("scans fully when the previous analysis has no per-commit result", () => {
    expect(decideScanMode(input({ previous: previous({ results: [result("usage")] }) }))).toMatchObject({
      mode: "full",
      reason: "the previous analysis has no code checks to reuse",
    });
  });
});

describe("reuseResult", () => {
  it("keeps the measured result and drops what the new analysis sets itself", () => {
    const from = { analysisId: "a", checkedAt: "2026-11-18T02:00:00Z", commit: COMMIT };
    const copy = reuseResult(
      result("complexity", { status: "fail", rating: 2.1, mandatoryFrom: "2027-03-01", starRating: 2 }),
      from
    );

    expect(copy).toMatchObject({ id: "complexity", status: "fail", rating: 2.1, starRating: 2, reusedFrom: from });
    expect(copy).not.toHaveProperty("mandatoryFrom");
    expect(copy).not.toHaveProperty("requirementLevel");
  });

  it("drops stars that were filled in from the status, so a reused pass rates like a measured one", () => {
    const from = { analysisId: "a", checkedAt: "2026-11-18T02:00:00Z", commit: COMMIT };
    const copy = reuseResult(result("tests", { status: "pass", starRating: 5 }), from);

    expect(copy).not.toHaveProperty("starRating");
    expect(criterionRating(copy)).toBe(5.5);
  });
});

describe("inputsFingerprint", () => {
  const settings = {
    helmChartLocations: ["charts/a", "charts/b"],
    dockerLocations: [],
    isRegister: true,
    complexityThreshold: 15,
    complexityMaxCcnThreshold: 30,
  };

  it("ignores the order of the hints and changes with any setting", () => {
    const base = inputsFingerprint(settings);
    expect(base).toMatch(/^sha256:[0-9a-f]{32}$/);
    expect(inputsFingerprint({ ...settings, helmChartLocations: ["charts/b", "charts/a"] })).toBe(base);
    expect(inputsFingerprint({ ...settings, helmChartLocations: ["charts/a"] })).not.toBe(base);
    expect(inputsFingerprint({ ...settings, isRegister: false })).not.toBe(base);
    expect(inputsFingerprint({ ...settings, complexityThreshold: 10 })).not.toBe(base);
  });
});

describe("readFullScanIntervalDays", () => {
  it("reads a whole number of days and falls back to 7", () => {
    expect(readFullScanIntervalDays({ FULL_SCAN_INTERVAL_DAYS: "3" })).toBe(3);
    expect(readFullScanIntervalDays({})).toBe(DEFAULT_FULL_SCAN_INTERVAL_DAYS);
    expect(readFullScanIntervalDays({ FULL_SCAN_INTERVAL_DAYS: "0" })).toBe(7);
    expect(readFullScanIntervalDays({ FULL_SCAN_INTERVAL_DAYS: "1.5" })).toBe(7);
  });
});

describe("toPreviousAnalysis", () => {
  it("reads a stored analysis and refuses one without results", () => {
    expect(
      toPreviousAnalysis({
        id: "a",
        checkedAt: "2026-11-18T02:00:00Z",
        scannedCommit: COMMIT,
        checklistVersion: "2026.1",
        toolFingerprint: "sha256:t",
        results: [result("docker")],
      })
    ).toEqual({
      id: "a",
      checkedAt: "2026-11-18T02:00:00Z",
      scannedCommit: COMMIT,
      checklistVersion: "2026.1",
      toolFingerprint: "sha256:t",
      inputsFingerprint: null,
      results: [result("docker")],
    });
    expect(toPreviousAnalysis({ checkedAt: "2026-11-18T02:00:00Z" })).toBeNull();
    expect(toPreviousAnalysis(null)).toBeNull();
  });
});
