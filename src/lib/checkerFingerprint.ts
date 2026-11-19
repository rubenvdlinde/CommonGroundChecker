import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Written into the image at build time, where the sources are not copied. */
export const CHECKER_FINGERPRINT_FILE = "checker-fingerprint.json";

/**
 * The files that decide what a check measures: the checker's own code, its
 * npm dependencies and the files that pin the analysis tools.
 */
const FINGERPRINT_SOURCES = [
  "package.json",
  "package-lock.json",
  "Dockerfile",
  "scripts/install-analysis-tools.sh",
  "scripts/maintainability",
  "src/lib",
];

export interface CheckerFingerprint {
  fingerprint: string;
  checkerVersion: string;
  /** The pinned tools, for example "lizard==1.24.3" */
  tools: string[];
}

function filesUnder(root: string, relative: string): string[] {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [relative];
  return readdirSync(absolute)
    .sort()
    .flatMap((name) => filesUnder(root, path.posix.join(relative, name)));
}

/** The `name==version` and `name@version` pins in the Dockerfile's install lines. */
export function pinnedTools(dockerfile: string): string[] {
  const pins = new Set<string>();
  for (const match of dockerfile.matchAll(/(?:^|\s)((?:@?[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:==|@)\d[\w.+-]*)/gim)) {
    pins.add(match[1]);
  }
  return [...pins].sort();
}

/** Hashes the fingerprint sources under `root`. */
export function computeCheckerFingerprint(root: string): CheckerFingerprint {
  const hash = createHash("sha256");
  for (const file of FINGERPRINT_SOURCES.flatMap((source) => filesUnder(root, source))) {
    hash.update(file).update("\0").update(readFileSync(path.join(root, file))).update("\0");
  }
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8")) as { version?: string };
  const dockerfile = path.join(root, "Dockerfile");
  return {
    fingerprint: `sha256:${hash.digest("hex").slice(0, 32)}`,
    checkerVersion: pkg.version ?? "0.0.0",
    tools: existsSync(dockerfile) ? pinnedTools(readFileSync(dockerfile, "utf-8")) : [],
  };
}

let cached: CheckerFingerprint | null = null;

/**
 * The fingerprint of the running checker: the build-time file when there is
 * one, else computed from the sources in the working directory.
 */
export function checkerFingerprint(root = process.cwd()): CheckerFingerprint {
  if (cached) return cached;
  const file = path.join(root, CHECKER_FINGERPRINT_FILE);
  cached = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf-8")) as CheckerFingerprint)
    : computeCheckerFingerprint(root);
  return cached;
}
