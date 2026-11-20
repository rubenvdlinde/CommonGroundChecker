import { describe, expect, it } from "vitest";
import {
  checkSecretScanning,
  findingsToEvidence,
  isTestPath,
  parseGitleaksReport,
  secretScanResult,
} from "@/lib/checkers/secretScanning";

const SECRET_VALUE = "placeholder-secret-value-1234";

const report = JSON.stringify([
  {
    RuleID: "generic-api-key",
    Description: "Detected a Generic API Key",
    StartLine: 12,
    Match: `apiKey = "${SECRET_VALUE}"`,
    Secret: SECRET_VALUE,
    File: "/tmp/repo/src/config.ts",
    Fingerprint: "src/config.ts:generic-api-key:12",
  },
  {
    RuleID: "private-key",
    StartLine: 1,
    Match: SECRET_VALUE,
    Secret: SECRET_VALUE,
    File: "keys/id_rsa",
  },
]);

describe("parseGitleaksReport", () => {
  it("parses a findings array", () => {
    const findings = parseGitleaksReport(report);
    expect(findings).toHaveLength(2);
    expect(findings?.[0].RuleID).toBe("generic-api-key");
  });

  it("parses an empty report", () => {
    expect(parseGitleaksReport("[]")).toEqual([]);
  });

  it("returns null for content that is not a findings array", () => {
    expect(parseGitleaksReport("not json")).toBeNull();
    expect(parseGitleaksReport('{"RuleID":"x"}')).toBeNull();
  });
});

describe("findingsToEvidence", () => {
  it("formats rule-id: path:line relative to the repository", () => {
    const findings = parseGitleaksReport(report) ?? [];
    expect(findingsToEvidence(findings, "/tmp/repo")).toEqual([
      "generic-api-key: src/config.ts:12",
      "private-key: keys/id_rsa:1",
    ]);
  });

  it("never includes the secret or match value", () => {
    const findings = parseGitleaksReport(report) ?? [];
    const evidence = findingsToEvidence(findings, "/tmp/repo").join("\n");
    expect(evidence).not.toContain(SECRET_VALUE);
    expect(evidence).not.toContain("apiKey");
  });

  it("falls back when fields are missing", () => {
    expect(findingsToEvidence([{}])).toEqual(["unknown-rule: unknown-file"]);
  });
});

describe("secretScanResult", () => {
  it("passes when gitleaks reports no findings", () => {
    const result = secretScanResult({ ran: true, findings: [] });
    expect(result.id).toBe("secretscanning");
    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual([]);
  });

  it("fails with the count when gitleaks reports findings", () => {
    const findings = parseGitleaksReport(report) ?? [];
    const result = secretScanResult({ ran: true, findings }, "/tmp/repo");
    expect(result.status).toBe("fail");
    expect(result.message).toContain("2 potential secrets");
    expect(result.evidence).toEqual([
      "generic-api-key: src/config.ts:12",
      "private-key: keys/id_rsa:1",
    ]);
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
  });

  it("caps the evidence and reports the remainder", () => {
    const findings = Array.from({ length: 13 }, (_, index) => ({
      RuleID: "generic-api-key",
      File: `file${index}.ts`,
      StartLine: index + 1,
    }));
    const result = secretScanResult({ ran: true, findings });
    expect(result.message).toContain("13 potential secrets");
    expect(result.evidence).toHaveLength(11);
    expect(result.evidence?.[10]).toBe("... and 3 more");
  });

  it("warns with the first stderr lines when gitleaks could not run", () => {
    const stderr = ["line 1", "", "line 2", "line 3", "line 4", "line 5", "line 6"].join("\n");
    const result = secretScanResult({ ran: false, stderr });
    expect(result.status).toBe("warn");
    expect(result.message).toBe("Secret scanning could not run.");
    expect(result.evidence).toEqual(["line 1", "line 2", "line 3", "line 4", "line 5"]);
  });

  it("warns when the scan timed out", () => {
    const result = secretScanResult({ ran: false, timedOut: true });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("Secret scanning could not run");
    expect(result.message).toContain("120 seconds");
  });
});

describe("isTestPath", () => {
  it.each([
    "tests/config.ts",
    "src/test/resources/app.properties",
    "web/__tests__/api.ts",
    "spec/models/user_spec.rb",
    "src/fixtures/keys.json",
    "app/__fixtures__/token.txt",
    "pkg/testdata/cert.pem",
    "src/api.test.ts",
    "src/api.spec.js",
    "pkg/client_test.go",
    "src/zaken/test_api.py",
  ])("treats %s as a test path", (filePath) => {
    expect(isTestPath(filePath)).toBe(true);
  });

  it.each(["src/config.ts", "src/testing.ts", "docs/latest.md", "src/contest_api.py", "keys/id_rsa"])(
    "treats %s as production code",
    (filePath) => {
      expect(isTestPath(filePath)).toBe(false);
    }
  );
});

describe("test path findings", () => {
  const findings = [
    { RuleID: "generic-api-key", File: "/tmp/repo/src/config.ts", StartLine: 3 },
    { RuleID: "generic-api-key", File: "/tmp/repo/tests/fixtures/settings.json", StartLine: 7 },
    { RuleID: "private-key", File: "/tmp/repo/src/zaken/test_api.py", StartLine: 1 },
  ];

  it("leaves findings in test paths out by default and says how many", () => {
    const result = secretScanResult({ ran: true, findings }, "/tmp/repo");
    expect(result.status).toBe("fail");
    expect(result.message).toContain("1 potential secret in");
    expect(result.message).toContain("2 findings in test paths");
    expect(result.evidence).toEqual(["generic-api-key: src/config.ts:3"]);
  });

  it("passes when every finding is in a test path, and still reports the count", () => {
    const result = secretScanResult({ ran: true, findings: findings.slice(1) }, "/tmp/repo");
    expect(result.status).toBe("pass");
    expect(result.message).toContain("2 findings in test paths (tests, fixtures and test files) were left out");
  });

  it("keeps findings in test paths when the repository has its own .gitleaks.toml", () => {
    const result = secretScanResult({ ran: true, findings, projectConfig: true }, "/tmp/repo");
    expect(result.status).toBe("fail");
    expect(result.message).toContain("3 potential secrets");
    expect(result.message).not.toContain("left out");
    expect(result.evidence).toHaveLength(3);
  });
});

describe("checkSecretScanning", () => {
  it("warns when there is no local clone to scan", async () => {
    const result = await checkSecretScanning(undefined);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("Secret scanning could not run.");
  });
});
