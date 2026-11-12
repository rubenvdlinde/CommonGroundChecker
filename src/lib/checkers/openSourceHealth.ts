import { mkdtemp, readFile, rm } from "node:fs/promises";
import { load as loadYaml } from "js-yaml";
import os from "node:os";
import path from "node:path";
import { runPythonScript, TIMED_OUT } from "./pythonScript";
import type { CheckResult, StarRating } from "../types";
import { formatStars } from "../stars";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "open-source-health", "check_open_source_health.py");
const TIMEOUT_MS = (Number(process.env.OPEN_SOURCE_HEALTH_TIMEOUT_SECONDS) || 300) * 1000;
const REFERENCE_URL =
  "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/quality-model-documents/open-source-health.md";

const PROPERTY_LABELS: Record<string, string> = {
  vulnerabilities: "Vulnerabilities",
  freshness: "Freshness",
  activity: "Activity",
  licence: "Licence use",
  management: "Management",
};

interface HealthProperty {
  stars: StarRating | null;
  detail: Record<string, unknown> | null;
  affected?: Record<string, string> | null;
}

/** The part of the script's JSON report this checker reads. */
export interface OpenSourceHealthReport {
  dependencies: number;
  ecosystems: string[];
  overall: StarRating | null;
  properties: Record<string, HealthProperty>;
  errors?: string[];
}

const BASE_RESULT = {
  id: "opensourcehealth",
  title: "Open Source Health",
  description:
    "Rates the third-party dependencies from 1 to 5 stars on known vulnerabilities, freshness, activity, licence risk and dependency management.",
  referenceUrl: REFERENCE_URL,
} as const;

function warn(message: string, evidence: string[] = []): CheckResult {
  return { ...BASE_RESULT, status: "warn", message, evidence };
}

function detailText(key: string, property: HealthProperty): string {
  const detail = property.detail ?? {};
  if (key === "vulnerabilities") {
    return `${detail.critical ?? 0} critical, ${detail.high ?? 0} high, ${detail.moderate ?? 0} moderate`;
  }
  if (key === "licence") {
    const excluded = typeof detail.excluded === "number" && detail.excluded > 0
      ? ` (${detail.excluded} excluded by sigrid.yaml)`
      : "";
    return `${detail.critical ?? 0} critical, ${detail.high ?? 0} high, ${detail.medium ?? 0} medium, ${detail.low ?? 0} low risk${excluded}`;
  }
  if (key === "management") {
    return String(detail.note ?? "");
  }
  return Object.entries(detail)
    .filter(([name]) => name !== "rated")
    .map(([name, value]) => `${name} ${value}${name.endsWith("count") ? "" : "%"}`)
    .join(", ");
}

/** Turns the script's JSON report into a check result. */
export function mapOpenSourceHealthReport(report: OpenSourceHealthReport): CheckResult {
  if (report.overall === null) {
    return warn("No dependency data could be rated (no composer.lock, package-lock.json or pinned requirements.txt).");
  }

  const starRating = report.overall;
  const status = starRating >= 4 ? "pass" : starRating === 3 ? "warn" : "fail";
  const evidence = Object.entries(report.properties).map(([key, property]) => {
    const label = PROPERTY_LABELS[key] ?? key;
    return property.stars === null
      ? `${label}: not rated (data unavailable)`
      : `${label}: ${formatStars(property.stars)} ${detailText(key, property)}`;
  });
  const severe = Object.entries(report.properties.vulnerabilities?.affected ?? {})
    .filter(([, level]) => level === "critical" || level === "high")
    .slice(0, 10)
    .map(([dependency, level]) => `Vulnerable: ${dependency} (${level})`);
  evidence.push(...severe);
  if (report.errors?.length) {
    evidence.push(`${report.errors.length} registry request(s) failed; affected properties may be unrated`);
  }

  return {
    ...BASE_RESULT,
    status,
    starRating,
    aspectRatings: Object.fromEntries(
      Object.entries(report.properties).map(([key, property]) => [key, property.stars])
    ),
    message:
      `Open Source Health ${starRating} of 5 stars over ${report.dependencies} production dependencies ` +
      `(${report.ecosystems.join(", ")}). 4 stars or more passes, 3 stars warns.`,
    evidence,
  };
}

/**
 * The `license` regexes under `dependencychecker.exclude` in the repository's
 * sigrid.yaml. Sigrid matches them against library names and leaves a match out
 * of the licence risk only. A missing or unreadable file gives none.
 */
export async function licenceExcludes(repoPath: string): Promise<string[]> {
  let config: unknown;
  try {
    config = loadYaml(await readFile(path.join(repoPath, "sigrid.yaml"), "utf8"));
  } catch {
    return [];
  }
  const exclude = (config as { dependencychecker?: { exclude?: unknown } } | null)?.dependencychecker?.exclude;
  if (!Array.isArray(exclude)) return [];
  return exclude.flatMap((entry) => {
    const licence = (entry as { license?: unknown } | null)?.license;
    return typeof licence === "string" && licence !== "" ? [licence] : [];
  });
}

/** The script arguments for one repository, with its sigrid.yaml licence excludes. */
export async function openSourceHealthArgs(repoPath: string, jsonPath: string): Promise<string[]> {
  const excludes = await licenceExcludes(repoPath);
  return ["report", repoPath, "--json", jsonPath, ...excludes.flatMap((regex) => ["--exclude-licence", regex])];
}

export async function checkOpenSourceHealth(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return warn("The repository could not be cloned, so Open Source Health was not measured.");
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-osh-"));
  try {
    const jsonPath = path.join(tempRoot, "report.json");
    const run = await runPythonScript(SCRIPT_PATH, await openSourceHealthArgs(localRepoPath, jsonPath), TIMEOUT_MS);
    if (run.code === TIMED_OUT) {
      return warn(`Open Source Health analysis did not finish within ${TIMEOUT_MS / 1000} seconds.`);
    }
    if (run.code !== 0 && run.code !== 4) {
      return warn("Open Source Health analysis could not run. It needs python3.", run.stderr.trim().split(/\r?\n/).slice(-3));
    }
    const report = JSON.parse(await readFile(jsonPath, "utf8")) as OpenSourceHealthReport;
    return mapOpenSourceHealthReport(report);
  } catch (error) {
    return warn(`Open Source Health report could not be read: ${(error as Error).message}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
