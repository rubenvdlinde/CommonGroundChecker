import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import type { CheckResult, CheckStatus } from "../types";

const TITLE = "SPDX licence headers";
const DESCRIPTION =
  "Rates the share of git-tracked source files that carry an SPDX-License-Identifier header in their first 30 lines, or are covered by REUSE.toml, .reuse/dep5 or a .license sidecar file. The REUSE specification asks for every file; the star bands (100% five stars, 95% four, 80% three, 50% two) are this checker's own.";
const REFERENCE_URL = "https://reuse.software/spec/";

const SOURCE_FILE_PATTERN = /\.(php|js|mjs|cjs|jsx|ts|tsx|vue|py|java|go|cs|rb|css|scss)$/i;
const EXCLUDED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|coverage|vendor|\.next|generated)(\/|$)/i;
const MINIFIED_PATTERN = /\.min\.js$/i;
const HEADER_MARKER = "SPDX-License-Identifier:";
const HEADER_LINES = 30;
const HEADER_READ_BYTES = 16 * 1024;
const MAX_EVIDENCE_FILES = 20;

/** Keeps the source files the check rates, dropping dependency, build output and minified paths. */
export function selectSourceFiles(files: string[]): string[] {
  return files.filter(
    (file) =>
      SOURCE_FILE_PATTERN.test(file) &&
      !EXCLUDED_PATH_PATTERN.test(file) &&
      !MINIFIED_PATTERN.test(file)
  );
}

/** True when the first 30 lines of the content contain an SPDX-License-Identifier tag. */
export function hasSpdxHeader(content: string): boolean {
  return content.split(/\r?\n/, HEADER_LINES).some((line) => line.includes(HEADER_MARKER));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\/]/g, "\\$&");
}

/**
 * Converts a REUSE.toml `path` glob to a regular expression: `*` matches
 * within one path segment, `**` matches across segments, and `\*` is a
 * literal asterisk.
 */
export function reuseGlobToRegExp(glob: string): RegExp {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "\\" && glob[i + 1] === "*") {
      pattern += "\\*";
      i++;
    } else if (char === "*" && glob[i + 1] === "*") {
      pattern += ".*";
      i++;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else {
      pattern += escapeRegExp(char);
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesReuseGlob(file: string, glob: string): boolean {
  return reuseGlobToRegExp(glob).test(file);
}

function parseTomlStrings(value: string): string[] {
  return [...value.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map((match) =>
    match[1] !== undefined ? match[1].replace(/\\\\/g, "\\") : match[2]
  );
}

/**
 * Returns the `path` globs of every `[[annotations]]` table in a REUSE.toml
 * that also sets `SPDX-License-Identifier`. `path` may be a string or an
 * array of strings, and the array may span several lines.
 */
export function parseReuseTomlPaths(content: string): string[] {
  const globs: string[] = [];
  const tables = content.split(/^\s*\[\[\s*annotations\s*\]\]\s*$/m).slice(1);
  for (const table of tables) {
    const body = table.split(/^\s*\[/m)[0];
    const hasLicence = /^\s*["']?SPDX-License-Identifier["']?\s*=/m.test(body);
    const pathMatch = body.match(/^\s*path\s*=\s*(\[[\s\S]*?\]|"(?:[^"\\]|\\.)*"|'[^']*')/m);
    if (!hasLicence || !pathMatch) continue;
    globs.push(...parseTomlStrings(pathMatch[1]));
  }
  return globs;
}

function dep5GlobToRegExp(glob: string): RegExp {
  const pattern = [...glob]
    .map((char) => (char === "*" ? ".*" : char === "?" ? "." : escapeRegExp(char)))
    .join("");
  return new RegExp(`^${pattern}$`);
}

/**
 * Returns the `Files:` patterns of every paragraph in a .reuse/dep5 file that
 * also has a `License:` field. In dep5 `*` matches across `/` and `?` matches
 * one character.
 */
export function parseDep5Patterns(content: string): string[] {
  const patterns: string[] = [];
  for (const paragraph of content.split(/\r?\n\s*\r?\n/)) {
    const fields = new Map<string, string>();
    let current = "";
    for (const line of paragraph.split(/\r?\n/)) {
      const field = line.match(/^([A-Za-z-]+):\s*(.*)$/);
      if (field) {
        current = field[1].toLowerCase();
        fields.set(current, field[2]);
      } else if (/^\s/.test(line) && current) {
        fields.set(current, `${fields.get(current)} ${line.trim()}`);
      }
    }
    const files = fields.get("files");
    if (files && fields.has("license")) patterns.push(...files.split(/\s+/).filter(Boolean));
  }
  return patterns;
}

export function matchesDep5Pattern(file: string, pattern: string): boolean {
  return dep5GlobToRegExp(pattern).test(file);
}

/** Maps the covered share (0 to 1) to a star rating from 1 to 5. */
export function shareToStars(share: number): number {
  if (share >= 1) return 5;
  if (share >= 0.95) return 4;
  if (share >= 0.8) return 3;
  if (share >= 0.5) return 2;
  return 1;
}

export function starsToStatus(stars: number): CheckStatus {
  if (stars >= 4) return "pass";
  if (stars === 3) return "warn";
  return "fail";
}

/** Formats a share as a percentage rounded down to one decimal, so 99.96% never reads as 100%. */
export function formatShare(share: number): string {
  return `${(Math.floor(share * 1000) / 10).toFixed(1)}%`;
}

export interface SpdxCoverageInput {
  /** Every git-tracked file, used to find `.license` sidecar files. */
  trackedFiles: string[];
  /** Source files whose first 30 lines carry an SPDX header. */
  filesWithHeader: Set<string>;
  reuseTomlGlobs: string[];
  dep5Patterns: string[];
}

/** Decides the check result from the tracked files and how each is covered. */
export function evaluateSpdxCoverage(input: SpdxCoverageInput): CheckResult {
  const sourceFiles = selectSourceFiles(input.trackedFiles);
  const base = { id: "spdxheaders", title: TITLE, description: DESCRIPTION, referenceUrl: REFERENCE_URL };

  if (sourceFiles.length === 0) {
    return {
      ...base,
      status: "warn",
      message: "No git-tracked source files found to rate for SPDX licence headers.",
      evidence: [],
    };
  }

  const tracked = new Set(input.trackedFiles);
  const reuseRegExps = input.reuseTomlGlobs.map(reuseGlobToRegExp);
  const dep5RegExps = input.dep5Patterns.map(dep5GlobToRegExp);
  const uncovered = sourceFiles.filter(
    (file) =>
      !input.filesWithHeader.has(file) &&
      !tracked.has(`${file}.license`) &&
      !reuseRegExps.some((regExp) => regExp.test(file)) &&
      !dep5RegExps.some((regExp) => regExp.test(file))
  );

  const share = (sourceFiles.length - uncovered.length) / sourceFiles.length;
  const stars = shareToStars(share);
  return {
    ...base,
    status: starsToStatus(stars),
    message: `${formatShare(share)} of ${sourceFiles.length} source files carry an SPDX header (${stars} of 5 stars).${
      uncovered.length > 0 ? ` ${uncovered.length} file(s) have no SPDX-License-Identifier and are not covered by REUSE metadata.` : ""
    }`,
    evidence: uncovered.slice(0, MAX_EVIDENCE_FILES),
  };
}

function gitLsFiles(repoPath: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", repoPath, "ls-files", "-z"],
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(String(stdout).split("\0").filter(Boolean));
      }
    );
  });
}

async function readHead(file: string): Promise<string> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(HEADER_READ_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf-8");
  } finally {
    await handle.close();
  }
}

export async function checkSpdxHeaders(localRepoPath?: string): Promise<CheckResult> {
  const trackedFiles = localRepoPath ? await gitLsFiles(localRepoPath) : null;
  if (!localRepoPath || !trackedFiles) {
    return {
      id: "spdxheaders",
      title: TITLE,
      description: DESCRIPTION,
      status: "warn",
      message: "The repository could not be cloned, so SPDX licence headers were not checked.",
      evidence: [],
      referenceUrl: REFERENCE_URL,
    };
  }

  const filesWithHeader = new Set<string>();
  for (const file of selectSourceFiles(trackedFiles)) {
    const head = await readHead(path.join(localRepoPath, file)).catch(() => "");
    if (hasSpdxHeader(head)) filesWithHeader.add(file);
  }

  const reuseToml = trackedFiles.includes("REUSE.toml")
    ? await readFile(path.join(localRepoPath, "REUSE.toml"), "utf-8").catch(() => "")
    : "";
  const dep5 = trackedFiles.includes(".reuse/dep5")
    ? await readFile(path.join(localRepoPath, ".reuse/dep5"), "utf-8").catch(() => "")
    : "";

  return evaluateSpdxCoverage({
    trackedFiles,
    filesWithHeader,
    reuseTomlGlobs: parseReuseTomlPaths(reuseToml),
    dep5Patterns: parseDep5Patterns(dep5),
  });
}
