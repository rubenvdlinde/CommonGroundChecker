/**
 * Scans every repository in config/repositories.yml and writes the static
 * site's data files (see src/lib/staticSite/records.ts).
 *
 *   npm run --silent scan:static -- [--data DIR] [--only URL]... [--index-only]
 *       [--scoring FILE] [--concurrency N] [--timeout-minutes M] [--full]
 *
 * --only scans just those repositories; the index still lists every one.
 * --index-only scans nothing and rebuilds data/index.json from the config
 * and the files already there, for a change of the config alone.
 * --scoring is a saved copy of GET /api/admin/scoring; without it the
 * default scoring configuration is used and no API is called.
 * A repository whose scanned commit, checklist version, checker and scan
 * settings did not change since its latest.json reuses the code checks from
 * there and runs only the outside-world checks, unless the code checks are
 * FULL_SCAN_INTERVAL_DAYS (default 7) days old. --full runs every check.
 * Retired repositories are not scanned. A failed scan keeps the previous
 * analysis and is reported in the index as `lastError`.
 * Exit codes: 0 done (also with failed scans), 1 every scan failed, 2 could not run.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NO_RUN = 2;
/** Matches the nightly schedule of the workflow. */
const CHECK_INTERVAL_HOURS = 24;

export interface StaticScanArgs {
  data: string;
  only: string[];
  indexOnly: boolean;
  full: boolean;
  scoring?: string;
  concurrency: number;
  timeoutMinutes: number;
}

export function parseStaticScanArgs(argv: string[]): StaticScanArgs {
  const args: StaticScanArgs = { data: "data", only: [], indexOnly: false, full: false, concurrency: 1, timeoutMinutes: 45 };
  const value = (i: number, flag: string): string => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  const positive = (raw: string, flag: string): number => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${flag} needs a whole number of 1 or more`);
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--data") args.data = value(i++, a);
    else if (a === "--only") args.only.push(value(i++, a));
    else if (a === "--scoring") args.scoring = value(i++, a);
    else if (a === "--concurrency") args.concurrency = positive(value(i++, a), a);
    else if (a === "--timeout-minutes") args.timeoutMinutes = positive(value(i++, a), a);
    else if (a === "--index-only") args.indexOnly = true;
    else if (a === "--full") args.full = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

function checkerVersion(): string {
  const pkg = JSON.parse(readFileSync(path.join(CHECKER_ROOT, "package.json"), "utf-8")) as { version?: string };
  let sha = "unknown";
  try {
    sha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: CHECKER_ROOT, encoding: "utf-8" }).trim();
  } catch {
    // Not a git checkout, for example inside a container image.
  }
  return `${pkg.version ?? "0.0.0"}+${sha}`;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 1)}\n`);
}

function withTimeout<T>(promise: Promise<T>, minutes: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${minutes} minutes`)), minutes * 60_000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function main(argv: string[]): Promise<number> {
  let args: StaticScanArgs;
  try {
    args = parseStaticScanArgs(argv);
  } catch (error) {
    process.stderr.write(`scan:static: ${(error as Error).message}\n`);
    return NO_RUN;
  }

  const { parseYaml, normalizeRepositoryUrl, repositoryDataDir, repositoryPath, slasByRepository } = await import(
    "../src/lib/staticSite/config"
  );
  const { checkConfig } = await import("../src/lib/staticSite/validate");
  const records = await import("../src/lib/staticSite/records");
  type IndexFile = import("../src/lib/staticSite/records").IndexFile;
  type LatestFile = import("../src/lib/staticSite/records").LatestFile;
  type HistoryFile = import("../src/lib/staticSite/records").HistoryFile;
  type RepositoriesConfig = import("../src/lib/staticSite/config").RepositoriesConfig;
  type SlasConfig = import("../src/lib/staticSite/config").SlasConfig;

  const repositoriesRaw = parseYaml(readFileSync(path.join(CHECKER_ROOT, "config/repositories.yml"), "utf-8"));
  const slasRaw = parseYaml(readFileSync(path.join(CHECKER_ROOT, "config/slas.yml"), "utf-8"));
  const functionalitiesFile = path.join(CHECKER_ROOT, "config/functionalities.yml");
  const functionalitiesRaw = existsSync(functionalitiesFile) ? parseYaml(readFileSync(functionalitiesFile, "utf-8")) : undefined;
  const errors = checkConfig(repositoriesRaw, slasRaw, functionalitiesRaw).filter((finding) => finding.level === "error");
  if (errors.length > 0) {
    for (const finding of errors) process.stderr.write(`scan:static: ${finding.subject}: ${finding.message}\n`);
    return NO_RUN;
  }
  const config = repositoriesRaw as RepositoriesConfig;
  const slas = slasByRepository(slasRaw as SlasConfig);
  const dataRoot = path.resolve(args.data);
  const previousIndex = await readJson<IndexFile>(path.join(dataRoot, "index.json"));

  // stdout carries the progress lines only; checker logging goes to stderr.
  console.log = console.error;
  console.info = console.error;
  // The checkers resolve their bundled scripts and tools against the working directory.
  process.chdir(CHECKER_ROOT);
  const { runChecks } = await import("../src/lib/checkers/index");
  const { scoringConfigFromPayload } = await import("../src/lib/checkers/config");
  const { toPreviousAnalysis } = await import("../src/lib/incremental");
  const scoringConfig = args.scoring
    ? scoringConfigFromPayload(JSON.parse(readFileSync(path.resolve(args.scoring), "utf-8")))
    : scoringConfigFromPayload({});

  const only = new Set(args.only.map((url) => normalizeRepositoryUrl(url).toLowerCase()));
  const lastErrors = new Map<string, string | null>(
    (previousIndex?.repositories ?? []).map((entry) => [entry.repoUrl.toLowerCase(), entry.lastError])
  );
  const toScan = args.indexOnly
    ? []
    : config.repositories.filter(
        (entry) => !entry.retired && (only.size === 0 || only.has(normalizeRepositoryUrl(entry.url).toLowerCase()))
      );

  let failed = 0;
  const queue = [...toScan];
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const url = normalizeRepositoryUrl(entry.url);
      const repoPath = repositoryPath(url);
      const dir = path.join(dataRoot, repositoryDataDir(repoPath));
      const started = Date.now();
      try {
        const previous = await readJson<LatestFile>(path.join(dir, "latest.json"));
        const report = await withTimeout(
          runChecks(url, {
            helmChartLocations: entry.hints?.helm ?? [],
            dockerLocations: entry.hints?.docker ?? [],
            documentationLocations: entry.hints?.docs ?? [],
            apiSpecificationLocations: entry.hints?.apiSpecs ?? [],
            isRegister: entry.register === true,
            scoringConfig,
            // Read by checkers that resolve the scanned ref; ignored by those that scan the default branch.
            ...(entry.scanRef ? { ref: entry.scanRef } : {}),
            full: args.full,
            previousAnalysis: toPreviousAnalysis(previous?.analysis),
          } as Parameters<typeof runChecks>[1]),
          args.timeoutMinutes,
          `The scan of ${url}`
        );
        const durationSeconds = Math.round((Date.now() - started) / 100) / 10;
        const history = await readJson<HistoryFile>(path.join(dir, "history.json"));
        const latest = records.buildLatestFile(
          {
            path: repoPath,
            config: entry,
            report: report as Parameters<typeof records.buildLatestFile>[0]["report"],
            slas: slas.get(url.toLowerCase()) ?? [],
            durationSeconds,
            checkIntervalHours: CHECK_INTERVAL_HOURS,
          },
          previous
        );
        const nextHistory = records.appendToHistory(history, latest, previous);
        await writeJson(path.join(dir, "latest.json"), latest);
        await writeJson(path.join(dir, "history.json"), nextHistory);
        lastErrors.set(url.toLowerCase(), null);
        process.stdout.write(
          `scanned ${url} in ${durationSeconds} s (${report.scanMode ?? "full"} scan, ${report.scanModeReason ?? "no reason given"}): score ${latest.analysis.score}, rating ${latest.analysis.rating ?? "none"}, ` +
            `${nextHistory.drops.filter((drop) => drop.resolvedAt === null).length} open drops\n`
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        lastErrors.set(url.toLowerCase(), message);
        process.stdout.write(`failed ${url} after ${Math.round((Date.now() - started) / 1000)} s: ${message}\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(args.concurrency, Math.max(queue.length, 1)) }, worker));

  const now = new Date();
  const entries = [];
  for (const entry of config.repositories) {
    const url = normalizeRepositoryUrl(entry.url);
    const repoPath = repositoryPath(url);
    const dataDir = repositoryDataDir(repoPath);
    entries.push(
      records.buildIndexEntry(
        {
          path: repoPath,
          dataDir,
          config: entry,
          slas: slas.get(url.toLowerCase()) ?? [],
          latest: await readJson<LatestFile>(path.join(dataRoot, dataDir, "latest.json")),
          history: await readJson<HistoryFile>(path.join(dataRoot, dataDir, "history.json")),
          lastError: lastErrors.get(url.toLowerCase()) ?? null,
        },
        now
      )
    );
  }
  await writeJson(path.join(dataRoot, "index.json"), records.buildIndexFile(entries, checkerVersion(), now));
  process.stdout.write(
    `index: ${entries.length} repositories, ${toScan.length - failed} scanned, ${failed} failed\n`
  );
  return toScan.length > 0 && failed === toScan.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`scan:static: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exit(NO_RUN);
    });
}
