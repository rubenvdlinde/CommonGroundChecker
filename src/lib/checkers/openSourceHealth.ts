import { mkdtemp, readFile, rm } from "node:fs/promises";
import { load as loadYaml } from "js-yaml";
import os from "node:os";
import path from "node:path";
import { runPythonScript, TIMED_OUT } from "./pythonScript";
import type { CheckResult, MeasurementGroup, MeasurementRow, StarLevel, StarRating } from "../types";
import { STAR_LEVELS } from "../types";
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

/** Per star level ("5" to "2") the most dependencies allowed per key; null means no limit. */
type CountBands = Partial<Record<string, Record<string, number | null>>>;

interface AgeBands {
  /** Per bound in years, the largest share in percent each star level allows */
  bounds: { years: number; max_percent: Partial<Record<string, number>> }[];
  /** Above this many years no dependency may be; breaking it caps the rating at `cap_stars` */
  absolute: { years: number; max_count: number; cap_stars: number };
}

/** The thresholds of every star level per property. */
interface HealthBands {
  vulnerabilities?: CountBands;
  freshness?: AgeBands;
  activity?: AgeBands;
  licence?: CountBands;
  management?: { max_unmanaged_percent: Partial<Record<string, number>> };
}

/** The part of the script's JSON report this checker reads. */
export interface OpenSourceHealthReport {
  dependencies: number;
  ecosystems: string[];
  overall: StarRating | null;
  properties: Record<string, HealthProperty>;
  errors?: string[];
  bands?: HealthBands;
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

/** The rows of a licence or vulnerability table: one per risk class or severity. */
const COUNT_ROWS: Record<string, { label: string; keys: string[]; bandKey: string | null }[]> = {
  vulnerabilities: [
    { label: "Critical or high", keys: ["critical", "high"], bandKey: "critical_or_high" },
    { label: "Moderate", keys: ["moderate"], bandKey: "moderate" },
    { label: "Low", keys: ["low"], bandKey: null },
    { label: "Unknown severity", keys: ["unknown"], bandKey: null },
  ],
  licence: [
    { label: "Critical risk", keys: ["critical"], bandKey: "critical" },
    { label: "High risk", keys: ["high"], bandKey: "high" },
    { label: "Medium risk", keys: ["medium"], bandKey: "medium" },
    { label: "Low risk", keys: ["low"], bandKey: "low" },
  ],
};

function yearsText(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}

/** The detail key the script writes for a bound, for example ">1.0y" or ">3.5y". */
function boundKey(years: number): string {
  return `>${Number.isInteger(years) ? years.toFixed(1) : years}y`;
}

function percentText(value: number): string {
  return `${value.toFixed(1)}%`;
}

function countText(limit: number | null | undefined): string {
  if (limit === null || limit === undefined) return "any";
  return limit === 0 ? "none" : `≤ ${limit}`;
}

/** The highest star level whose threshold `fits` holds, else 1; null when no level has a threshold. */
function rowStars(fits: (level: StarLevel) => boolean | null): StarRating | null {
  const results = STAR_LEVELS.map((level) => [level, fits(level)] as const);
  if (results.every(([, fit]) => fit === null)) return null;
  return results.find(([, fit]) => fit !== false)?.[0] ?? 1;
}

function ageRows(detail: Record<string, unknown>, bands: AgeBands): MeasurementRow[] {
  const rows: MeasurementRow[] = bands.bounds.flatMap((bound) => {
    const share = detail[boundKey(bound.years)];
    if (typeof share !== "number") return [];
    const thresholds: Partial<Record<StarLevel, string>> = {};
    for (const level of STAR_LEVELS) {
      const limit = bound.max_percent[String(level)];
      if (typeof limit === "number") thresholds[level] = limit >= 100 ? "any" : `≤ ${percentText(limit)}`;
    }
    return [
      {
        label: `> ${yearsText(bound.years)}`,
        value: percentText(share),
        thresholds,
        stars: rowStars((level) => {
          const limit = bound.max_percent[String(level)];
          return typeof limit === "number" ? share <= limit : null;
        }),
      },
    ];
  });

  const { years, max_count: maxCount, cap_stars: capStars } = bands.absolute;
  const count = detail[`${boundKey(years)} count`];
  if (typeof count === "number") {
    const thresholds: Partial<Record<StarLevel, string>> = {};
    for (const level of STAR_LEVELS) {
      thresholds[level] = level > capStars ? countText(maxCount) : "any";
    }
    rows.push({
      label: `> ${yearsText(years)}, absolute bound`,
      value: `${count} ${count === 1 ? "dependency" : "dependencies"}`,
      thresholds,
      ...(count <= maxCount
        ? { stars: 5 as StarRating }
        : { stars: null, starsText: `caps at ${capStars} stars` }),
    });
  }
  return rows;
}

function countRows(property: string, detail: Record<string, unknown>, bands: CountBands): MeasurementRow[] {
  return (COUNT_ROWS[property] ?? []).map(({ label, keys, bandKey }) => {
    const value = keys.reduce((sum, key) => sum + (typeof detail[key] === "number" ? (detail[key] as number) : 0), 0);
    const limitAt = (level: StarLevel) => (bandKey === null ? null : bands[String(level)]?.[bandKey] ?? null);
    const thresholds: Partial<Record<StarLevel, string>> = {};
    for (const level of STAR_LEVELS) thresholds[level] = countText(limitAt(level));
    const stars = rowStars((level) => {
      const limit = limitAt(level);
      return limit === null ? null : value <= limit;
    });
    return { label, value: String(value), thresholds, stars, ...(stars === null ? { starsText: "not rated" } : {}) };
  });
}

function managementRows(
  detail: Record<string, unknown>,
  bands: NonNullable<HealthBands["management"]>
): MeasurementRow[] {
  const share = detail.unmanaged_percent;
  if (typeof share !== "number") return [];
  const limits = bands.max_unmanaged_percent;
  const thresholds: Partial<Record<StarLevel, string>> = {};
  for (const level of STAR_LEVELS) {
    const limit = limits[String(level)];
    if (typeof limit === "number") thresholds[level] = limit === 0 ? "none" : `≤ ${percentText(limit)}`;
  }
  return [
    {
      label: "Unmanaged third-party code",
      value: percentText(share),
      thresholds,
      stars: rowStars((level) => {
        const limit = limits[String(level)];
        return typeof limit === "number" ? share <= limit : null;
      }),
    },
  ];
}

function propertyRows(key: string, detail: Record<string, unknown>, bands: HealthBands): MeasurementRow[] {
  switch (key) {
    case "freshness":
    case "activity":
      return bands[key] ? ageRows(detail, bands[key]) : [];
    case "vulnerabilities":
    case "licence":
      return bands[key] ? countRows(key, detail, bands[key]) : [];
    case "management":
      return bands.management ? managementRows(detail, bands.management) : [];
    default:
      return [];
  }
}

/**
 * The measured values of every rated property against the thresholds of each
 * star level, one group per property, keyed by its aspect. A report without
 * bands, or a property without data, gives no group.
 */
export function openSourceHealthMeasurements(report: OpenSourceHealthReport): MeasurementGroup[] {
  const bands = report.bands;
  if (!bands) return [];
  return Object.entries(report.properties).flatMap(([key, property]) => {
    const rows = property.detail ? propertyRows(key, property.detail, bands) : [];
    if (rows.length === 0) return [];
    return [{ id: key, title: PROPERTY_LABELS[key] ?? key, aspects: [key], rows }];
  });
}

/** Turns the script's JSON report into a check result. */
export function mapOpenSourceHealthReport(report: OpenSourceHealthReport): CheckResult {
  if (report.overall === null) {
    return warn("No dependency data could be rated (no composer.lock, package-lock.json or pinned requirements.txt).");
  }

  const starRating = report.overall;
  const measurements = openSourceHealthMeasurements(report);
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
    ...(measurements.length > 0 ? { measurements } : {}),
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
