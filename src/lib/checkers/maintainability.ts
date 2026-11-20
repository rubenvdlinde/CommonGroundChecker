import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPythonScript, TIMED_OUT } from "./pythonScript";
import type { CheckResult, MeasurementGroup, MeasurementRow, StarLevel, StarRating } from "../types";
import { STAR_LEVELS } from "../types";
import { formatStars, ratingToStars } from "../stars";
import { PASSING_MAINTAINABILITY_STARS } from "../ratings";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "maintainability", "check_maintainability.py");
const TIMEOUT_MS = (Number(process.env.MAINTAINABILITY_TIMEOUT_SECONDS) || 600) * 1000;
/** Exit status of the script when no file in a supported language is in scope. */
const NOTHING_TO_JUDGE = 4;
const NO_SOURCE_MESSAGE =
  "No source code in a supported language (PHP, JavaScript, TypeScript, Vue, Python) was found to rate.";
const REFERENCE_URL =
  "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/sig-quality-models.md";

const PROPERTY_LABELS: Record<string, string> = {
  duplication: "Duplication",
  unit_size: "Unit size",
  unit_complexity: "Unit complexity",
  unit_interfacing: "Unit interfacing",
  module_coupling: "Module coupling",
  component_independence: "Component independence",
  component_entanglement: "Component entanglement",
};

const LANGUAGE_LABELS: Record<string, string> = {
  php: "PHP",
  javascript: "JavaScript",
  typescript: "TypeScript",
  vue: "Vue",
  python: "Python",
};

/** The code properties each ISO 25010 sub-characteristic is measured through, as the script rates them. */
export const SUBCHARACTERISTIC_PROPERTIES: Record<string, string[]> = {
  analysability: ["duplication", "unit_size"],
  modifiability: ["duplication", "unit_complexity", "module_coupling"],
  testability: ["unit_complexity", "component_independence"],
  modularity: ["module_coupling", "component_independence", "component_entanglement"],
  reusability: ["unit_size", "unit_interfacing"],
};

/** How each bound of a property with several bounds reads in a table row. */
const BOUND_LABELS: Record<string, (bound: number) => string> = {
  unit_size: (bound) => `more than ${bound} lines`,
  unit_complexity: (bound) => `complexity above ${bound}`,
  unit_interfacing: (bound) => `${bound + 1} or more parameters`,
  module_coupling: (bound) => `fan-in above ${bound}`,
};

/** A star level as the script reports it: 1 to 5, or "<4" where no level below 4 is estimated. */
type ReportedStars = number | string | null | undefined;

interface BoundMeasurement {
  above: number;
  share: number;
  limit?: number;
  stars?: ReportedStars;
}

interface ShareMeasurement {
  share: number;
  limit?: number;
  stars?: ReportedStars;
}

interface LanguageMeasurements {
  unit_size?: BoundMeasurement[];
  unit_complexity?: BoundMeasurement[];
  unit_interfacing?: BoundMeasurement[];
  duplication?: ShareMeasurement;
}

interface StructureMeasurements {
  module_coupling?: BoundMeasurement[];
  component_independence?: { hidden_share: number; limit_min?: number; stars?: ReportedStars };
  component_entanglement?: { violation_degree: number; limit?: number; stars?: ReportedStars };
}

/** Star bands per property: per level the maximum share per bound, or one value. */
type ReportBands = Record<string, Partial<Record<string, number | number[]>> & { bounds?: number[] }>;

interface RatedLanguage {
  rating: number | null;
  loc: number;
}

interface Lever {
  property: string;
  language: string;
  loc_for_half_star?: number | null;
}

/** The part of the script's JSON report this checker reads. */
export interface MaintainabilityReport {
  files: number;
  skipped_files?: string[];
  /** Per language ("php", "python", "js/ts/vue"); a warning means independence and entanglement were not rated. */
  structure?: Record<string, { warning?: string } | null>;
  rating: {
    overall: { range: [number, number] } | null;
    properties: Record<string, { rating: number | null; languages: Record<string, RatedLanguage> }>;
    /** ISO 25010 sub-characteristics: analysability, modifiability, testability, modularity, reusability */
    subcharacteristics?: Record<string, number | null>;
    levers?: Lever[];
  };
  /** Measurements per language */
  languages?: Record<string, LanguageMeasurements>;
  /** Module coupling and component structure per language */
  structure?: Record<string, StructureMeasurements>;
  /** Every star level per property */
  bands?: ReportBands;
}

const BASE_RESULT = {
  id: "maintainability",
  title: "Maintainability (ISO 25010)",
  description:
    "Estimates a 1 to 5 star maintainability rating from unit size, complexity, interfacing, duplication, module coupling and component structure.",
  referenceUrl: REFERENCE_URL,
} as const;

function warn(message: string, evidence: string[] = []): CheckResult {
  return { ...BASE_RESULT, status: "warn", message, evidence };
}

function propertyLine(key: string, rating: number, languages: Record<string, RatedLanguage>): string {
  const perLanguage = Object.entries(languages)
    .filter(([, value]) => value.rating !== null)
    .map(([language, value]) => `${language} ${value.rating!.toFixed(1)}`)
    .join(", ");
  const label = PROPERTY_LABELS[key] ?? key;
  return `${label}: ${formatStars(ratingToStars(rating))} ${rating.toFixed(1)}${perLanguage ? ` (${perLanguage})` : ""}`;
}

function leverLine(lever: Lever): string {
  const label = (PROPERTY_LABELS[lever.property] ?? lever.property).toLowerCase();
  const effort = lever.loc_for_half_star ? `, about ${lever.loc_for_half_star} lines to fix for half a star` : "";
  return `Lever: ${label} in ${lever.language}${effort}`;
}

function languageLabel(language: string): string {
  return LANGUAGE_LABELS[language] ?? language;
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function atMostPercent(share: number): string {
  return `≤ ${percent(share)}`;
}

function decimal(value: number): string {
  return String(Number(value.toFixed(4)));
}

function reportedStars(stars: ReportedStars): Pick<MeasurementRow, "stars" | "starsText"> {
  if (typeof stars === "number" && Number.isInteger(stars) && stars >= 1 && stars <= 5) {
    return { stars: stars as StarRating };
  }
  if (typeof stars === "string" && stars.startsWith("<")) {
    return { stars: null, starsText: `below ${stars.slice(1)} stars` };
  }
  return { stars: null };
}

/**
 * The threshold per star level, read from the report's bands with `pick`; when
 * the report has no bands, only the 4-star limit of the measurement itself.
 */
function thresholdsFrom(
  levels: Partial<Record<string, number | number[]>> | undefined,
  pick: (level: number | number[]) => number | undefined,
  format: (value: number) => string,
  fourStarLimit: number | undefined
): Partial<Record<StarLevel, string>> {
  const thresholds: Partial<Record<StarLevel, string>> = {};
  for (const level of STAR_LEVELS) {
    const raw = levels?.[String(level)];
    const value = raw === undefined ? undefined : pick(raw);
    if (typeof value === "number") thresholds[level] = format(value);
  }
  if (!levels && typeof fourStarLimit === "number") thresholds[4] = format(fourStarLimit);
  return thresholds;
}

function boundRows(
  property: string,
  language: string,
  measured: BoundMeasurement[] | undefined,
  bands: ReportBands | undefined
): MeasurementRow[] {
  const band = bands?.[property];
  return (measured ?? []).map((row, index) => {
    const boundIndex = band?.bounds?.indexOf(row.above) ?? -1;
    const position = boundIndex === -1 ? index : boundIndex;
    return {
      label: `${languageLabel(language)}, ${BOUND_LABELS[property](row.above)}`,
      value: percent(row.share),
      thresholds: thresholdsFrom(
        band,
        (level) => (Array.isArray(level) ? level[position] : undefined),
        atMostPercent,
        row.limit
      ),
      ...reportedStars(row.stars),
    };
  });
}

function singleRow(
  language: string,
  value: string,
  levels: Partial<Record<string, number | number[]>> | undefined,
  format: (value: number) => string,
  limit: number | undefined,
  stars: ReportedStars
): MeasurementRow {
  return {
    label: languageLabel(language),
    value,
    thresholds: thresholdsFrom(levels, (level) => (typeof level === "number" ? level : undefined), format, limit),
    ...reportedStars(stars),
  };
}

function propertyRows(property: string, report: MaintainabilityReport): MeasurementRow[] {
  const languages = Object.entries(report.languages ?? {});
  const structures = Object.entries(report.structure ?? {});
  const bands = report.bands;

  switch (property) {
    case "unit_size":
    case "unit_complexity":
    case "unit_interfacing":
      return languages.flatMap(([language, measured]) => boundRows(property, language, measured[property], bands));
    case "module_coupling":
      return structures.flatMap(([language, measured]) => boundRows(property, language, measured.module_coupling, bands));
    case "duplication":
      return languages.flatMap(([language, { duplication: measured }]) =>
        measured
          ? [
              singleRow(language, percent(measured.share), bands?.duplication, atMostPercent, measured.limit, measured.stars),
            ]
          : []
      );
    case "component_independence":
      return structures.flatMap(([language, { component_independence: measured }]) =>
        measured
          ? [
              singleRow(
                language,
                percent(measured.hidden_share),
                bands?.component_independence,
                (value) => `≥ ${percent(value)}`,
                measured.limit_min,
                measured.stars
              ),
            ]
          : []
      );
    case "component_entanglement":
      return structures.flatMap(([language, { component_entanglement: measured }]) =>
        measured
          ? [
              singleRow(
                language,
                decimal(measured.violation_degree),
                bands?.component_entanglement,
                (value) => `≤ ${decimal(value)}`,
                measured.limit,
                measured.stars
              ),
            ]
          : []
      );
    default:
      return [];
  }
}

/**
 * The measured share per property, language and bound, against the thresholds
 * of every star level, grouped per property with the sub-characteristics it
 * counts in. Properties that were not measured are left out.
 */
export function maintainabilityMeasurements(report: MaintainabilityReport): MeasurementGroup[] {
  return Object.keys(PROPERTY_LABELS).flatMap((property) => {
    const rows = propertyRows(property, report);
    if (rows.length === 0) return [];
    return [
      {
        id: property.replace(/_/g, "-"),
        title: PROPERTY_LABELS[property],
        aspects: Object.keys(SUBCHARACTERISTIC_PROPERTIES).filter((key) =>
          SUBCHARACTERISTIC_PROPERTIES[key].includes(property)
        ),
        rows,
      },
    ];
  });
}

/** Turns the script's JSON report into a check result. */
export function mapMaintainabilityReport(report: MaintainabilityReport): CheckResult {
  const overall = report.rating.overall;
  if (!overall) {
    return warn(NO_SOURCE_MESSAGE);
  }

  const [low, high] = overall.range;
  const rating = (low + high) / 2;
  const starRating = ratingToStars(rating);
  const status = starRating >= PASSING_MAINTAINABILITY_STARS ? "pass" : starRating === 3 ? "warn" : "fail";
  const measurements = maintainabilityMeasurements(report);

  const evidence = Object.entries(report.rating.properties)
    .filter(([, property]) => property.rating !== null)
    .map(([key, property]) => propertyLine(key, property.rating!, property.languages));
  for (const [language, structure] of Object.entries(report.structure ?? {})) {
    if (structure?.warning) {
      evidence.push(`Not rated (${language}): ${structure.warning}`);
    }
  }
  evidence.push(...(report.rating.levers ?? []).slice(0, 3).map(leverLine));
  if (report.skipped_files?.length) {
    evidence.push(`Skipped ${report.skipped_files.length} file(s) the analyser could not read`);
  }

  return {
    ...BASE_RESULT,
    status,
    starRating,
    rating,
    aspectRatings: report.rating.subcharacteristics,
    ...(measurements.length > 0 ? { measurements } : {}),
    message:
      `Estimated maintainability rating ${low.toFixed(2)} to ${high.toFixed(2)} (${starRating} of 5 stars) over ${report.files} file(s). ` +
      "4 stars or more passes, 3 stars warns.",
    evidence,
  };
}

export async function checkMaintainability(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return warn("The repository could not be cloned, so maintainability was not measured.");
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-maintainability-"));
  try {
    const jsonPath = path.join(tempRoot, "report.json");
    const run = await runPythonScript(SCRIPT_PATH, ["report", localRepoPath, "--json", jsonPath], TIMEOUT_MS);
    if (run.code === TIMED_OUT) {
      return warn(`Maintainability analysis did not finish within ${TIMEOUT_MS / 1000} seconds.`);
    }
    if (run.code === NOTHING_TO_JUDGE) {
      return warn(NO_SOURCE_MESSAGE);
    }
    if (run.code !== 0) {
      return warn(
        "Maintainability analysis could not run. It needs python3 with lizard 1.24.3 and jscpd 4.0.5.",
        run.stderr.trim().split(/\r?\n/).slice(-3)
      );
    }
    const report = JSON.parse(await readFile(jsonPath, "utf8")) as MaintainabilityReport;
    return mapMaintainabilityReport(report);
  } catch (error) {
    return warn(`Maintainability report could not be read: ${(error as Error).message}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
