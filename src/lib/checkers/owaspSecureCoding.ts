import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { buildLegacyRepoContext } from "./compat";

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|py|java|go|cs|php|rb|vue)$/i;
const EXCLUDED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|coverage|vendor|\.next|generated)(\/|$)/i;
// Test code by directory (including end-to-end suites, Android instrumentation tests and
// `test-*` support folders) or by file name (`*.test.ts`, Go's `*_test.go`, pytest's `test_*.py`).
const TEST_PATH_PATTERN =
  /(^|\/)(tests?|__tests__|spec|fixtures|__fixtures__|testdata|e2e|androidTest|tests?[-_][^/]+)(\/|$)|\.(test|spec)\.[^/]+$|_test\.[^/.]+$|(^|\/)test_[^/]*\.py$/i;
const MAX_FILES_TO_SCAN = 20;
// The scan fails once findings exceed 10 per 1,000 scanned files, with at least 3
// tolerated, so repositories under 400 scanned files still fail from 4 findings.
const MIN_TOLERATED_FINDINGS = 3;
const TOLERATED_FINDINGS_PER_1000_FILES = 10;

export function getFailThreshold(scannedFileCount: number): number {
  const tolerated = Math.max(
    MIN_TOLERATED_FINDINGS,
    Math.floor((scannedFileCount * TOLERATED_FINDINGS_PER_1000_FILES) / 1000)
  );
  return tolerated + 1;
}

const RISKY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Dynamic code execution", pattern: /\beval\s*\(|\bFunction\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/i },
  { label: "Unsafe HTML injection", pattern: /innerHTML\s*=|dangerouslySetInnerHTML/i },
  { label: "Shell command execution", pattern: /subprocess\.(run|call|Popen)\([^\n]*shell\s*=\s*True|os\.system\s*\(|child_process\.(exec|execSync)\s*\(/i },
  { label: "Insecure deserialization", pattern: /pickle\.loads\s*\(|yaml\.load\s*\(/i },
  { label: "Weak hash algorithm", pattern: /hashlib\.(md5|sha1)\s*\(|createHash\s*\(\s*["'](?:md5|sha1)["']|MessageDigest\.getInstance\(\s*["'](?:MD5|SHA-1)["']/i },
  { label: "TLS verification disabled", pattern: /verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|sslverify\s*=\s*false/i },
  { label: "Possible hardcoded secret", pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\n]{8,}["']/i },
];

function getScannableFiles(tree: string[], scanAllFiles: boolean): string[] {
  const filtered = tree
    .filter((path) => SOURCE_FILE_PATTERN.test(path))
    .filter((path) => !EXCLUDED_PATH_PATTERN.test(path))
    .filter((path) => !TEST_PATH_PATTERN.test(path));

  return scanAllFiles ? filtered : filtered.slice(0, MAX_FILES_TO_SCAN);
}

export async function checkOwaspSecureCoding(
  context: RepoContext,
  tree: string[],
  localRepoPath?: string
): Promise<CheckResult>;
export async function checkOwaspSecureCoding(
  owner: string,
  repo: string,
  tree: string[],
  localRepoPath?: string
): Promise<CheckResult>;
export async function checkOwaspSecureCoding(
  contextOrOwner: RepoContext | string,
  arg2: string[] | string,
  arg3?: string[] | string,
  arg4?: string
): Promise<CheckResult> {
  const context =
    typeof contextOrOwner === "string"
      ? buildLegacyRepoContext(contextOrOwner, arg2 as string)
      : contextOrOwner;
  const tree =
    typeof contextOrOwner === "string"
      ? (arg3 as string[])
      : (arg2 as string[]);
  const localRepoPath =
    typeof contextOrOwner === "string"
      ? (arg4 as string | undefined)
      : (arg3 as string | undefined);
  const filesToScan = getScannableFiles(tree, Boolean(localRepoPath));

  if (filesToScan.length === 0) {
    return {
      id: "owaspsecurecoding",
      title: "OWASP Secure Coding",
      description:
        "Performs a heuristic static scan for common risky coding patterns aligned with OWASP secure coding concerns.",
      status: "info",
      message:
        "No supported source files were found for the OWASP secure coding heuristic scan.",
      evidence: [],
      referenceUrl:
        "https://cheatsheetseries.owasp.org/IndexTopTen.html",
    };
  }

  const contents = await Promise.all(
    filesToScan.map(async (relativePath) => {
      const content = localRepoPath
        ? await readFile(path.join(localRepoPath, relativePath), "utf-8").catch(() => "")
        : await context.provider.getFileContent(context, relativePath);
      return { path: relativePath, content };
    })
  );

  const findings: string[] = [];
  let scannedFileCount = 0;

  for (const item of contents) {
    if (!item.content) continue;
    scannedFileCount += 1;

    for (const rule of RISKY_PATTERNS) {
      if (rule.pattern.test(item.content)) {
        findings.push(`${rule.label}: ${item.path}`);
      }
    }
  }

  if (scannedFileCount === 0) {
    return {
      id: "owaspsecurecoding",
      title: "OWASP Secure Coding",
      description:
        "Performs a heuristic static scan for common risky coding patterns aligned with OWASP secure coding concerns.",
      status: "warn",
      message:
        "Source files were found, but their contents could not be analyzed for the OWASP secure coding check.",
      evidence: filesToScan.slice(0, 10),
      referenceUrl:
        "https://cheatsheetseries.owasp.org/IndexTopTen.html",
    };
  }

  if (findings.length === 0) {
    return {
      id: "owaspsecurecoding",
      title: "OWASP Secure Coding",
      description:
        "Performs a heuristic static scan for common risky coding patterns aligned with OWASP secure coding concerns.",
      status: "pass",
      message:
        `No obvious OWASP-style risky coding patterns were detected in ${scannedFileCount} scanned source files.`,
      evidence: filesToScan.slice(0, 10),
      referenceUrl:
        "https://cheatsheetseries.owasp.org/IndexTopTen.html",
    };
  }

  const failThreshold = getFailThreshold(scannedFileCount);
  const status = findings.length >= failThreshold ? "fail" : "warn";

  return {
    id: "owaspsecurecoding",
    title: "OWASP Secure Coding",
    description:
      "Performs a heuristic static scan for common risky coding patterns aligned with OWASP secure coding concerns.",
    status,
    message:
      status === "fail"
        ? `Multiple risky coding patterns were detected (${findings.length} findings across ${scannedFileCount} scanned source files, failing from ${failThreshold}). Review them against OWASP secure coding guidance.`
        : `Potential OWASP secure coding issues were detected (${findings.length} findings across ${scannedFileCount} scanned source files, failing from ${failThreshold}).`,
    evidence: findings,
    referenceUrl:
      "https://cheatsheetseries.owasp.org/IndexTopTen.html",
  };
}
