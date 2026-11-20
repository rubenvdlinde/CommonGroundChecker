import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CheckResult, CheckStatus, StarRating } from "../types";
import { EXCLUDED_PATH_PATTERN } from "./owaspSecureCoding";

const execFileAsync = promisify(execFile);

const ID = "testcoderatio";
const TITLE = "Test code ratio";
const DESCRIPTION =
  "Lines of test code relative to lines of production code, rated from 1 to 5 stars. " +
  "A 100% test code ratio corresponds roughly to 80% coverage, so the 95/80/60/20% coverage bands " +
  "become 120/100/75/25% test code.";
const REFERENCE_URL = "https://iso25000.com/index.php/en/iso-25000-standards/iso-25010";

const SOURCE_FILE_PATTERN = /\.(php|js|mjs|cjs|jsx|ts|tsx|vue|py|java|go|cs|rb)$/i;
const MINIFIED_FILE_PATTERN = /\.min\.js$/i;
const TEST_DIRECTORY_PATTERN = /(^|\/)(test|tests|__tests__|spec)\//i;
const TEST_FILE_NAME_PATTERNS: RegExp[] = [
  /\.test\.[^./]+$/i,
  /\.spec\.[^./]+$/i,
  /_test\.[^./]+$/i,
  /^test_[^/]*\.py$/i,
  /Test\.(php|java)$/,
];

/** Lower bounds (inclusive, in percent) for 5, 4, 3 and 2 stars; anything lower is 1 star. */
export const STAR_BANDS: ReadonlyArray<{ stars: StarRating; minRatio: number }> = [
  { stars: 5, minRatio: 120 },
  { stars: 4, minRatio: 100 },
  { stars: 3, minRatio: 75 },
  { stars: 2, minRatio: 25 },
];

export type FileClass = "test" | "production" | "excluded";

/**
 * Classifies a repository-relative path. Paths that are not source files, or that live in
 * dependency, build or generated directories, or are minified bundles, are "excluded".
 */
export function classifyFile(filePath: string): FileClass {
  const normalized = filePath.replace(/\\/g, "/");
  if (!SOURCE_FILE_PATTERN.test(normalized)) return "excluded";
  if (EXCLUDED_PATH_PATTERN.test(normalized) || MINIFIED_FILE_PATTERN.test(normalized)) {
    return "excluded";
  }

  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (
    TEST_DIRECTORY_PATTERN.test(normalized) ||
    TEST_FILE_NAME_PATTERNS.some((pattern) => pattern.test(fileName))
  ) {
    return "test";
  }
  return "production";
}

/**
 * Counts code lines: non-blank lines that do not start (after whitespace) with a comment
 * marker (`//`, `#`, `/*`, `*`, `*\/`). A line starting with `#[` counts as code, because
 * PHP and Rust use it for attributes. Comment markers inside strings and trailing comments
 * are not interpreted; this is a line heuristic, not a parser.
 */
export function countCodeLines(content: string): number {
  let count = 0;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    if (line.startsWith("#[")) {
      count += 1;
      continue;
    }
    if (/^(\/\/|#|\/\*|\*)/.test(line)) continue;
    count += 1;
  }
  return count;
}

/** Test code lines as a percentage of production code lines, or null without production code. */
export function computeTestCodeRatio(testLines: number, productionLines: number): number | null {
  if (productionLines <= 0) return null;
  return (testLines / productionLines) * 100;
}

export function ratioToStars(ratioPercent: number): StarRating {
  for (const band of STAR_BANDS) {
    if (ratioPercent >= band.minRatio) return band.stars;
  }
  return 1;
}

export function starsToStatus(stars: number): CheckStatus {
  if (stars >= 4) return "pass";
  if (stars === 3) return "warn";
  return "fail";
}

export interface TestCodeRatioCounts {
  testLines: number;
  productionLines: number;
  testFiles: number;
  productionFiles: number;
}

function formatCount(value: number, noun: string): string {
  return `${value.toLocaleString("en-US")} ${noun}${value === 1 ? "" : "s"}`;
}

function bandsEvidence(): string {
  return (
    "Bands: " +
    STAR_BANDS.map((band) => `>=${band.minRatio}% = ${band.stars} stars`).join(", ") +
    ", below 25% = 1 star (100% test code is roughly 80% coverage)"
  );
}

/** Builds the check result from line and file counts. */
export function buildTestCodeRatioResult(counts: TestCodeRatioCounts): CheckResult {
  const countEvidence = [
    `Test code: ${formatCount(counts.testLines, "line")} in ${formatCount(counts.testFiles, "file")}`,
    `Production code: ${formatCount(counts.productionLines, "line")} in ${formatCount(counts.productionFiles, "file")}`,
  ];

  const ratio = computeTestCodeRatio(counts.testLines, counts.productionLines);
  if (ratio === null) {
    return {
      id: ID,
      title: TITLE,
      description: DESCRIPTION,
      status: "warn",
      message: "No production source code found, so the test code ratio cannot be rated.",
      evidence: [...countEvidence, bandsEvidence()],
      referenceUrl: REFERENCE_URL,
    };
  }

  const stars = ratioToStars(ratio);
  return {
    id: ID,
    title: TITLE,
    description: DESCRIPTION,
    status: starsToStatus(stars),
    starRating: stars,
    message: `Test code ratio ${ratio.toFixed(1)}% (${stars} of 5 stars).`,
    evidence: [`Test code ratio: ${ratio.toFixed(1)}%`, ...countEvidence, bandsEvidence()],
    referenceUrl: REFERENCE_URL,
  };
}

async function listTrackedFiles(repoDir: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["-C", repoDir, "ls-files", "-z"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split("\0").filter(Boolean);
}

/** Counts test and production code lines over the git-tracked files of a local clone. */
export async function measureTestCodeRatio(repoDir: string): Promise<TestCodeRatioCounts> {
  const counts: TestCodeRatioCounts = {
    testLines: 0,
    productionLines: 0,
    testFiles: 0,
    productionFiles: 0,
  };

  for (const file of await listTrackedFiles(repoDir)) {
    const fileClass = classifyFile(file);
    if (fileClass === "excluded") continue;

    let content: string;
    try {
      content = await readFile(path.join(repoDir, file), "utf8");
    } catch {
      continue;
    }

    const lines = countCodeLines(content);
    if (fileClass === "test") {
      counts.testLines += lines;
      counts.testFiles += 1;
    } else {
      counts.productionLines += lines;
      counts.productionFiles += 1;
    }
  }

  return counts;
}

export async function checkTestCodeRatio(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return {
      id: ID,
      title: TITLE,
      description: DESCRIPTION,
      status: "warn",
      message: "The repository could not be cloned, so the test code ratio could not be measured.",
      evidence: [],
      referenceUrl: REFERENCE_URL,
    };
  }

  try {
    return buildTestCodeRatioResult(await measureTestCodeRatio(localRepoPath));
  } catch (error) {
    return {
      id: ID,
      title: TITLE,
      description: DESCRIPTION,
      status: "warn",
      message: "The tracked files of the cloned repository could not be read.",
      evidence: [error instanceof Error ? error.message : String(error)].slice(0, 1),
      referenceUrl: REFERENCE_URL,
    };
  }
}
