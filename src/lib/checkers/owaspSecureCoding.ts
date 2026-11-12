import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { buildLegacyRepoContext } from "./compat";

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|py|java|go|cs|php|rb|vue)$/i;
const EXCLUDED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|coverage|vendor|\.next|generated)(\/|$)/i;
const MAX_FILES_TO_SCAN = 20;

interface RiskyPattern {
  label: string;
  pattern: RegExp;
  /** Tells a real hit from a look-alike; a match it rejects is not a finding. */
  accept?: (match: RegExpExecArray) => boolean;
}

const SECRET_KEYWORDS = new Set(["apikey", "secret", "password", "passwd", "token"]);

/**
 * A value that cannot be a credential: a bracketed or angled placeholder such as
 * `[redacted]`, a delimited regular expression, or the name of a setting or key
 * that spells out its key word as one of its parts (`portal_assertion_secret`).
 * A name is made of plain lower-case words, so a random or mixed-case value
 * (`secret_9fQx...`) and a word glued to its key word (`password123`) still count.
 */
export function isSecretLookAlike(value: string): boolean {
  if (/^\[[^\]]*\]$|^<[^>]*>$/.test(value)) return true;
  if (/^\/.+\/[a-z]*$/i.test(value)) return true;
  const parts = value.replace(/^api[_-]key/, "apikey").split(/[_\-:.]+/).filter(Boolean);
  return (
    parts.length > 0 &&
    parts.every((part) => /^[a-z]{1,24}\d{0,3}$/.test(part)) &&
    parts.some((part) => SECRET_KEYWORDS.has(part))
  );
}

const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|#(?![[!]))/;

/** Blanks lines that hold only a comment, so prose that names a risky call is not read as code. */
export function stripCommentLines(content: string): string {
  return content
    .split("\n")
    .map((line) => (COMMENT_LINE.test(line) ? "" : line))
    .join("\n");
}

function hasFinding(rule: RiskyPattern, content: string): boolean {
  if (!rule.accept) {
    return rule.pattern.test(content);
  }
  const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (rule.accept(match)) return true;
  }
  return false;
}

const RISKY_PATTERNS: RiskyPattern[] = [
  // Case-sensitive: the JavaScript Function constructor is capitalised, while `function (` is an ordinary closure.
  // A method named eval (`model.eval()`, `$parser->eval()`) is not the eval built-in.
  { label: "Dynamic code execution", pattern: /(?<![\w$.>:])eval\s*\(|(?<![\w$.])Function\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/ },
  { label: "Unsafe HTML injection", pattern: /innerHTML\s*=|dangerouslySetInnerHTML/i },
  { label: "Shell command execution", pattern: /subprocess\.(run|call|Popen)\([^\n]*shell\s*=\s*True|os\.system\s*\(|child_process\.(exec|execSync)\s*\(/i },
  { label: "Insecure deserialization", pattern: /pickle\.loads\s*\(|yaml\.load\s*\(/i },
  { label: "Weak hash algorithm", pattern: /hashlib\.(md5|sha1)\s*\(|createHash\s*\(\s*["'](?:md5|sha1)["']|MessageDigest\.getInstance\(\s*["'](?:MD5|SHA-1)["']/i },
  { label: "TLS verification disabled", pattern: /verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|sslverify\s*=\s*false/i },
  // A bound attribute such as Vue's `:token="createdToken"` holds an expression, not a literal.
  {
    label: "Possible hardcoded secret",
    pattern: /(?<![:@])(?:api[_-]?key|secret|password|token)\s*[:=]\s*(["'])((?:(?!\1)[^\\\n]|\\.){8,})\1/i,
    accept: (match) => !isSecretLookAlike(match[2]),
  },
];

function getScannableFiles(tree: string[], scanAllFiles: boolean): string[] {
  const filtered = tree
    .filter((path) => SOURCE_FILE_PATTERN.test(path))
    .filter((path) => !EXCLUDED_PATH_PATTERN.test(path));

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

    const code = stripCommentLines(item.content);
    for (const rule of RISKY_PATTERNS) {
      if (hasFinding(rule, code)) {
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

  const status = findings.length >= 4 ? "fail" : "warn";

  return {
    id: "owaspsecurecoding",
    title: "OWASP Secure Coding",
    description:
      "Performs a heuristic static scan for common risky coding patterns aligned with OWASP secure coding concerns.",
    status,
    message:
      findings.length >= 4
        ? `Multiple risky coding patterns were detected (${findings.length} findings across ${scannedFileCount} scanned source files). Review them against OWASP secure coding guidance.`
        : `Potential OWASP secure coding issues were detected (${findings.length} findings across ${scannedFileCount} scanned source files).`,
    evidence: findings,
    referenceUrl:
      "https://cheatsheetseries.owasp.org/IndexTopTen.html",
  };
}
