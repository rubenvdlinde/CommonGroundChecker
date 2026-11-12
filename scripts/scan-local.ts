/**
 * Scans a local git checkout with the checker's criteria and prints one JSON document.
 *
 *   npm run --silent scan:local -- <checkout> [--owner O] [--repo R] [--register]
 *       [--scoring FILE] [--api-spec PATH]... [--out FILE] [--full]
 *
 * The checkout is read in place: tracked and untracked files (ignores honoured), the
 * best tag reachable from HEAD as the version, the licence from the LICENSE file.
 * Without --scoring the default scoring configuration is used and no API is called;
 * FILE is a saved copy of GET /api/admin/scoring.
 *
 * A criterion whose tool or service could not run is listed in `unmeasured`: its
 * status says nothing about the checkout.
 *
 * Exit codes: 0 scanned, 2 could not scan (bad arguments, not a git checkout, crash).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIZARD_VERSION = "1.24.3";
const NO_SCAN = 2;

/** Messages a criterion reports when its tool or an external service did not run. */
export const UNMEASURED_PATTERNS: RegExp[] = [
  /not installed on the checker host/i,
  /\bis not available\b/i,
  /could not run/i,
  /could not be cloned/i,
  /Could not clone repository/i,
  /report could not be read/i,
  /tracked files of the cloned repository could not be read/i,
  /could not be retrieved/i,
  /did not respond within/i,
  /registry request\(s\) failed/i,
  /could not be fully validated/i,
];

export interface ScanArgs {
  checkout: string;
  owner?: string;
  repo?: string;
  register: boolean;
  scoring?: string;
  apiSpecs: string[];
  out?: string;
  full: boolean;
}

export function parseArgs(argv: string[]): ScanArgs {
  const args: ScanArgs = { checkout: "", register: false, apiSpecs: [], full: false };
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--owner") args.owner = value(i++, a);
    else if (a === "--repo") args.repo = value(i++, a);
    else if (a === "--scoring") args.scoring = value(i++, a);
    else if (a === "--api-spec") args.apiSpecs.push(value(i++, a));
    else if (a === "--out") args.out = value(i++, a);
    else if (a === "--register") args.register = true;
    else if (a === "--full") args.full = true;
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else if (!args.checkout) args.checkout = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if (!args.checkout) throw new Error("pass the checkout directory");
  return args;
}

export function isUnmeasured(message: string): boolean {
  return UNMEASURED_PATTERNS.some((pattern) => pattern.test(message));
}

function gitOut(dir: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-c", "safe.directory=*", ...args], { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function commandWorks(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Puts the pinned lizard of the shared tool cache on PATH when none is installed. */
function provideLizard(): void {
  if (commandWorks("lizard", ["--version"])) return;
  const toolsDir = process.env.HYDRA_GATE_TOOLS_DIR
    ?? path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "hydra-gates", "tools");
  const target = path.join(toolsDir, `lizard-${LIZARD_VERSION}`);
  if (!existsSync(path.join(target, "bin", "lizard"))) return;
  process.env.PATH = `${path.join(target, "bin")}${path.delimiter}${process.env.PATH ?? ""}`;
  process.env.PYTHONPATH = [target, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
}

function checkerVersion(): string {
  const pkg = JSON.parse(readFileSync(path.join(CHECKER_ROOT, "package.json"), "utf-8")) as { version?: string };
  const sha = gitOut(CHECKER_ROOT, ["rev-parse", "--short=12", "HEAD"]);
  const dirty = gitOut(CHECKER_ROOT, ["status", "--porcelain", "--untracked-files=no", "--", "src", "scripts"]);
  return `${pkg.version ?? "0.0.0"}+${sha ?? "unknown"}${dirty ? "-dirty" : ""}`;
}

async function main(argv: string[]): Promise<number> {
  let args: ScanArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`scan-local: ${(error as Error).message}\n`);
    return NO_SCAN;
  }

  const checkout = path.resolve(args.checkout);
  if (gitOut(checkout, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    process.stderr.write(`scan-local: ${checkout} is not a git checkout\n`);
    return NO_SCAN;
  }
  const top = gitOut(checkout, ["rev-parse", "--show-toplevel"]);
  if (top && path.resolve(top) !== checkout) {
    process.stderr.write(`scan-local: pass the top of the checkout (${top}), not ${checkout}\n`);
    return NO_SCAN;
  }

  let scoringPayload: unknown;
  if (args.scoring) {
    try {
      scoringPayload = JSON.parse(readFileSync(path.resolve(args.scoring), "utf-8"));
    } catch (error) {
      process.stderr.write(`scan-local: cannot read --scoring ${args.scoring}: ${(error as Error).message}\n`);
      return NO_SCAN;
    }
  }

  // stdout carries the JSON document only; checker logging goes to stderr.
  console.log = console.error;
  console.info = console.error;
  console.warn = console.error;
  // The checkers resolve their bundled scripts and tools against the working directory.
  process.chdir(CHECKER_ROOT);
  provideLizard();
  const { runChecksOnContext } = await import("../src/lib/checkers/index");
  const { scoringConfigFromPayload } = await import("../src/lib/checkers/config");
  const { createLocalContext, resolveLocalCheckout } = await import("../src/lib/providers/local");

  const local = await resolveLocalCheckout(checkout, args.owner, args.repo);
  const scoringConfig = scoringConfigFromPayload(scoringPayload ?? {});
  const report = await runChecksOnContext(createLocalContext(local), {
    localRepoPath: checkout,
    scoringConfig,
    isRegister: args.register,
    apiSpecificationLocations: args.apiSpecs,
  });

  const criteria: Record<string, { status: string; title: string; requirementLevel?: string; message: string }> = {};
  const unmeasured: string[] = [];
  for (const result of report.results) {
    criteria[result.id] = {
      status: result.status,
      title: result.title,
      requirementLevel: result.requirementLevel,
      message: result.message,
    };
    if (isUnmeasured(result.message)) unmeasured.push(result.id);
  }

  const document = {
    tool: "common-ground-checker scan-local",
    toolVersion: checkerVersion(),
    checkout,
    owner: local.owner,
    repo: local.repo,
    commit: gitOut(checkout, ["rev-parse", "HEAD"]),
    dirty: Boolean(gitOut(checkout, ["status", "--porcelain"])),
    checkedAt: report.checkedAt,
    scoringConfigId: scoringConfig.id,
    scoringDigest: createHash("sha256").update(JSON.stringify(scoringConfig.config)).digest("hex").slice(0, 16),
    score: report.score,
    rating: report.rating ?? null,
    version: report.repoMeta?.version ?? null,
    criteria,
    unmeasured,
    ...(args.full ? { report } : {}),
  };
  const json = JSON.stringify(document, null, 2);
  if (args.out) writeFileSync(args.out, `${json}\n`);
  process.stdout.write(`${json}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`scan-local: the scan crashed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exit(NO_SCAN);
    });
}
