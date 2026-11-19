import type { CheckReport, CheckResult } from "@/lib/types";

export function result(id: string, status: CheckResult["status"], extra: Partial<CheckResult> = {}): CheckResult {
  return { id, title: id, description: "", status, message: `${id} ${status}`, requirementLevel: "mandatory", ...extra };
}

export function publiccodeResult(usedBy: string[], developmentStatus = "stable"): CheckResult {
  return result("publiccode", "pass", {
    publiccode: { usedBy, developmentStatus } as unknown as CheckResult["publiccode"],
  });
}

export function report(overrides: Partial<CheckReport> = {}): CheckReport {
  return {
    repoUrl: "https://github.com/open-zaak/open-zaak",
    owner: "open-zaak",
    repo: "open-zaak",
    checkedAt: "2026-11-19T02:00:00.000Z",
    scoringConfigId: null,
    score: 70,
    rating: 3.6,
    categoryRatings: { Security: 3.2, Maintainability: 3.4 },
    aspectRatings: {},
    endorsement: { passed: true, reasons: [] },
    results: [publiccodeResult(["Gemeente Utrecht", "Gemeente Den Haag"]), result("license", "pass"), result("sbom", "warn")],
    repoMeta: {
      description: "Zaakregistratiecomponent",
      language: "Python",
      stars: 1,
      forks: 1,
      defaultBranch: "main",
      topics: ["zaken"],
      license: "EUPL-1.2",
      version: "1.31.2",
      versionEvidence: { source: "release", detail: "release v1.31.2" },
      displayName: "Open Zaak",
      shortDescription: "Zaken API",
      logoUrl: null,
      developmentStatus: "stable",
      maintenanceType: "contract",
      maintainers: ["Maykin"],
    },
    ...overrides,
  };
}
