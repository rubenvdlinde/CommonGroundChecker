import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { CheckResult, CheckStatus } from "../types";

const CHECK_ID = "secretscanning";
const TITLE = "No committed secrets";
const DESCRIPTION =
  "The repository's working tree is scanned with gitleaks for committed secrets such as API keys, tokens and private keys. Findings in test paths such as tests/ and fixtures/ are left out, unless the project has its own .gitleaks.toml. A project's own .gitleaks.toml and .gitleaksignore are honoured.";
const REFERENCE_URL = "https://github.com/gitleaks/gitleaks";
const SCAN_TIMEOUT_MS = 120_000;
const MAX_EVIDENCE_LINES = 10;
const TEST_PATH_PATTERN =
  /(^|\/)(tests?|__tests__|spec|fixtures|__fixtures__|testdata)(\/|$)|\.(test|spec)\.[^/]+$|_test\.[^/]+$|(^|\/)test_[^/]*\.py$/i;

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** One finding from a gitleaks JSON report; only the fields used for evidence are typed. */
export interface GitleaksFinding {
  RuleID?: string;
  File?: string;
  StartLine?: number;
}

export interface SecretScanOutcome {
  /** Gitleaks ran and produced a parseable report. */
  ran: boolean;
  timedOut?: boolean;
  findings?: GitleaksFinding[];
  /** The repository has its own .gitleaks.toml, so no default test path exclusion applies. */
  projectConfig?: boolean;
  /** Diagnostic output shown when the scan could not run. */
  stderr?: string;
}

function runCommand(command: string, args: string[], timeoutMs?: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs)
      : undefined;

    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      finish({ code: 127, stdout, stderr: `${stderr}\n${error.message}`, timedOut });
    });

    child.on("close", (code) => {
      finish({ code: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Finds a working gitleaks binary on PATH or in /usr/local/bin. */
export async function detectGitleaksCommand(): Promise<string | null> {
  for (const candidate of ["gitleaks", "/usr/local/bin/gitleaks"]) {
    const probe = await runCommand(candidate, ["version"]);
    if (probe.code === 0) {
      return candidate;
    }
  }
  return null;
}

/** Parses a gitleaks JSON report; returns null when the content is not a findings array. */
export function parseGitleaksReport(content: string): GitleaksFinding[] | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as GitleaksFinding[]) : null;
  } catch {
    return null;
  }
}

function findingPath(finding: GitleaksFinding, repoPath?: string): string {
  const file = finding.File || "unknown-file";
  return repoPath && path.isAbsolute(file) ? path.relative(repoPath, file) : file;
}

/** True for paths of tests and test data: test directories, fixtures and test file names. */
export function isTestPath(filePath: string): boolean {
  return TEST_PATH_PATTERN.test(filePath.replace(/\\/g, "/"));
}

/**
 * Turns findings into `rule-id: path:line` lines. Only the rule, file and line
 * are read, so secret values in the report never reach the evidence.
 */
export function findingsToEvidence(findings: GitleaksFinding[], repoPath?: string): string[] {
  return findings.map((finding) => {
    const rule = finding.RuleID || "unknown-rule";
    const file = findingPath(finding, repoPath);
    const line = typeof finding.StartLine === "number" ? `:${finding.StartLine}` : "";
    return `${rule}: ${file}${line}`;
  });
}

function firstLines(text: string, count: number): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

function result(status: CheckStatus, message: string, evidence: string[]): CheckResult {
  return {
    id: CHECK_ID,
    title: TITLE,
    description: DESCRIPTION,
    status,
    message,
    evidence,
    referenceUrl: REFERENCE_URL,
  };
}

/** Maps a scan outcome to a check result: no findings pass, findings fail, a scan that could not run warns. */
export function secretScanResult(outcome: SecretScanOutcome, repoPath?: string): CheckResult {
  if (outcome.timedOut) {
    return result(
      "warn",
      `Secret scanning could not run: gitleaks did not finish within ${SCAN_TIMEOUT_MS / 1000} seconds.`,
      []
    );
  }

  if (!outcome.ran || !outcome.findings) {
    return result("warn", "Secret scanning could not run.", firstLines(outcome.stderr ?? "", 5));
  }

  const findings = outcome.projectConfig
    ? outcome.findings
    : outcome.findings.filter((finding) => !isTestPath(findingPath(finding, repoPath)));
  const excluded = outcome.findings.length - findings.length;
  const excludedNote =
    excluded > 0
      ? ` ${excluded} finding${excluded === 1 ? "" : "s"} in test paths (tests, fixtures and test files) ${excluded === 1 ? "was" : "were"} left out; add a .gitleaks.toml to the repository to decide this yourself.`
      : "";

  const count = findings.length;
  if (count === 0) {
    return result("pass", `Gitleaks found no committed secrets in the working tree.${excludedNote}`, []);
  }

  const evidence = findingsToEvidence(findings, repoPath);
  const shown = evidence.slice(0, MAX_EVIDENCE_LINES);
  if (evidence.length > shown.length) {
    shown.push(`... and ${evidence.length - shown.length} more`);
  }

  return result(
    "fail",
    `Gitleaks found ${count} potential secret${count === 1 ? "" : "s"} in the working tree. Rotate any real credential and remove it from the repository, or allowlist false positives in .gitleaks.toml.${excludedNote}`,
    shown
  );
}

/** Scans the working tree of a local clone with gitleaks. */
export async function checkSecretScanning(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return secretScanResult({ ran: false, stderr: "The repository could not be cloned." });
  }

  const gitleaks = await detectGitleaksCommand();
  if (!gitleaks) {
    return secretScanResult({ ran: false, stderr: "gitleaks is not installed on the checker host." });
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-gitleaks-"));
  const reportPath = path.join(tempRoot, "report.json");

  try {
    const args = [
      "dir",
      localRepoPath,
      "--report-format",
      "json",
      "--report-path",
      reportPath,
      "--no-banner",
      "--no-color",
      "--redact",
      "--gitleaks-ignore-path",
      localRepoPath,
    ];

    const projectConfig = path.join(localRepoPath, ".gitleaks.toml");
    const hasProjectConfig = await fileExists(projectConfig);
    if (hasProjectConfig) {
      args.push("--config", projectConfig);
    }

    const scan = await runCommand(gitleaks, args, SCAN_TIMEOUT_MS);
    if (scan.timedOut) {
      return secretScanResult({ ran: false, timedOut: true });
    }

    // gitleaks exits 1 both for "leaks found" and for fatal errors; only a report distinguishes them.
    const report = (await fileExists(reportPath)) ? parseGitleaksReport(await readFile(reportPath, "utf8")) : null;
    if ((scan.code !== 0 && scan.code !== 1) || report === null) {
      return secretScanResult({ ran: false, stderr: scan.stderr || `gitleaks exited with code ${scan.code}` });
    }

    return secretScanResult({ ran: true, findings: report, projectConfig: hasProjectConfig }, localRepoPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
