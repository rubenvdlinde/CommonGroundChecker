import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { CheckResult, MeasurementGroup, MeasurementRow, StarLevel, StarRating } from "../types";
import { STAR_LEVELS } from "../types";
import { formatStars, ratingToStars } from "../stars";
import {
  OPEN_TRACK_THRESHOLDS,
  scoreOpenTrack,
  type Histogram,
  type OpenTrackInput,
  type OpenTrackThresholds,
  type PropertyScore,
} from "../openModel/score";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "open-track", "measure.py");
const TIMEOUT_MS = (Number(process.env.MAINTAINABILITY_TIMEOUT_SECONDS) || 600) * 1000;
/** Exit status of the script when no file in a supported language is in scope. */
const NOTHING_TO_MEASURE = 4;
/** Alves, Ypma and Visser 2010, Deriving metric thresholds from benchmark data */
const REFERENCE_URL = "https://doi.org/10.1109/ICSM.2010.5609747";

const PROPERTY_LABELS: Record<string, string> = {
  unit_size: "Unit size",
  unit_complexity: "Unit complexity",
  unit_interfacing: "Unit interfacing",
  duplication: "Duplication",
  module_coupling: "Module coupling",
  component_independence: "Component independence",
  component_entanglement: "Component entanglement",
};

/** How each bound of a risk-profile property reads. */
const BOUND_LABELS: Record<string, (bound: number) => string> = {
  unit_size: (bound) => `more than ${bound} lines`,
  unit_complexity: (bound) => `complexity above ${bound}`,
  unit_interfacing: (bound) => `${bound + 1} or more parameters`,
  module_coupling: (bound) => `fan-in above ${bound}`,
};

/** The unit of the bounds in a one-line summary. */
const BOUND_UNITS: Record<string, string> = {
  unit_size: "lines",
  unit_complexity: "complexity",
  unit_interfacing: "parameters",
  module_coupling: "fan-in",
};

const UNIT_PROPERTIES = ["unit_size", "unit_complexity", "unit_interfacing"] as const;

interface LanguageMeasures {
  code_loc: number;
  unit_loc: number;
  unit_size: Histogram;
  unit_complexity: Histogram;
  unit_interfacing: Histogram;
  duplication?: { lines: number; duplicated_lines: number };
}

/** The JSON the measure script writes. */
export interface OpenTrackScriptMeasures {
  schema: number;
  files: number;
  skipped_files?: Array<{ file: string; reason: string }>;
  tools: Record<string, string | null>;
  languages: Record<string, LanguageMeasures>;
}

const BASE_RESULT = {
  id: "opentrack",
  title: "Maintainability, open track",
  description:
    "Rates unit size, unit complexity, unit interfacing, duplication, module coupling, component independence and component entanglement against open thresholds derived from a public benchmark of Common Ground and Developer Overheid repositories. Informative: shown next to the estimate, not counted.",
  referenceUrl: REFERENCE_URL,
} as const;

function info(message: string, evidence: string[] = []): CheckResult {
  return { ...BASE_RESULT, status: "info", message, evidence };
}

/** All languages of a repository pooled into one open-track input, as the benchmark pools them. */
export function openTrackInput(measures: OpenTrackScriptMeasures): OpenTrackInput {
  const histograms: Record<string, Histogram> = {};
  let lines = 0;
  let duplicatedLines = 0;
  let duplicationMeasured = false;
  for (const language of Object.values(measures.languages)) {
    for (const property of UNIT_PROPERTIES) {
      const pooled = (histograms[property] ??= {});
      for (const [value, loc] of Object.entries(language[property] ?? {})) {
        pooled[value] = (pooled[value] ?? 0) + loc;
      }
    }
    if (language.duplication) {
      duplicationMeasured = true;
      lines += language.duplication.lines;
      duplicatedLines += language.duplication.duplicated_lines;
    }
  }
  return {
    histograms,
    shares: duplicationMeasured && lines > 0 ? { duplication: duplicatedLines / lines } : {},
  };
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function rowStars(fits: (level: StarLevel) => boolean): StarRating {
  return STAR_LEVELS.find(fits) ?? 1;
}

/** How a share property's value reads: the formatted value and what it is. */
const SHARE_FORMATS: Record<string, { value: (share: number) => string; what: string }> = {
  duplication: { value: percent, what: "duplicated lines" },
  component_independence: { value: percent, what: "of the code hidden from other components" },
  component_entanglement: { value: (share) => share.toFixed(3), what: "violation degree" },
};

function shareFormat(property: string) {
  return SHARE_FORMATS[property] ?? { value: percent, what: "" };
}

function measurementRows(score: PropertyScore): MeasurementRow[] {
  const { limits } = score;
  if (!limits) return [];
  if (score.share !== undefined) {
    const format = shareFormat(score.property).value;
    const thresholds: MeasurementRow["thresholds"] = {};
    for (const level of STAR_LEVELS) {
      const cap = limits[level];
      if (typeof cap === "number") thresholds[level] = `${score.atLeast ? "≥" : "≤"} ${format(cap)}`;
    }
    return [{ label: "All languages", value: format(score.share), thresholds, stars: score.stars ?? 1 }];
  }
  return (score.shares ?? []).map((share, index) => {
    const thresholds: MeasurementRow["thresholds"] = {};
    for (const level of STAR_LEVELS) {
      const caps = limits[level];
      if (Array.isArray(caps)) thresholds[level] = `≤ ${percent(caps[index])}`;
    }
    const bound = score.bounds![index];
    return {
      label: `All languages, ${BOUND_LABELS[score.property]?.(bound) ?? `above ${bound}`}`,
      value: percent(share),
      thresholds,
      stars: rowStars((level) => {
        const caps = limits[level];
        return Array.isArray(caps) && share <= caps[index];
      }),
    };
  });
}

function evidenceLine(score: PropertyScore): string {
  const label = PROPERTY_LABELS[score.property] ?? score.property;
  if (score.stars === null) return `${label}: ${score.reason}`;
  if (score.share !== undefined) {
    const format = shareFormat(score.property);
    return `${label}: ${formatStars(score.stars)} ${format.value(score.share)} ${format.what}`.trimEnd();
  }
  const shares = (score.shares ?? []).map(percent).join(" / ");
  const bounds = (score.bounds ?? []).join(" / ");
  const unit = BOUND_UNITS[score.property];
  return `${label}: ${formatStars(score.stars)} ${shares} of the code above ${bounds}${unit ? ` ${unit}` : ""}`;
}

/** Turns raw open-track measures, plus measures other checks add, into a check result. */
export function mapOpenTrack(
  input: OpenTrackInput,
  thresholds: OpenTrackThresholds = OPEN_TRACK_THRESHOLDS,
  skippedFiles = 0
): CheckResult {
  const score = scoreOpenTrack(input, thresholds);
  if (score.rating === null) {
    return info("No open-track property could be rated.", score.properties.map(evidenceLine));
  }
  const measurements: MeasurementGroup[] = score.properties.flatMap((property) => {
    const rows = measurementRows(property);
    if (rows.length === 0) return [];
    return [{ id: `open-${property.property.replace(/_/g, "-")}`, title: PROPERTY_LABELS[property.property], aspects: [], rows }];
  });
  const rated = score.properties.filter((property) => property.stars !== null).length;
  const evidence = score.properties.map(evidenceLine);
  evidence.push(
    `Thresholds ${thresholds.version}, derived from ${thresholds.benchmark.repositories} benchmark repositories (${thresholds.benchmark.list})`
  );
  if (skippedFiles > 0) evidence.push(`Skipped ${skippedFiles} file(s) the analyser could not read`);

  return {
    ...BASE_RESULT,
    status: "info",
    starRating: ratingToStars(score.rating),
    rating: score.rating,
    measurements,
    message:
      `Open-track rating ${score.rating.toFixed(1)} of 5, the mean of ${rated} rated propert${rated === 1 ? "y" : "ies"}. ` +
      "Open thresholds from a public benchmark, not a SIG rating; shown for information and not counted.",
    evidence,
  };
}

function runScript(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("python3", [SCRIPT_PATH, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stderr: error.message });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: signal ? 124 : code ?? 1, stderr });
    });
  });
}

/** What the measure script produced for one repository: the input to rate, or the result to show instead. */
export type OpenTrackMeasurement = { input: OpenTrackInput; skippedFiles: number } | { failure: CheckResult };

/** Runs the open-track measure script on a cloned repository. */
export async function measureOpenTrack(localRepoPath?: string): Promise<OpenTrackMeasurement> {
  if (!localRepoPath) {
    return { failure: info("The repository could not be cloned, so the open track was not measured.") };
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-open-track-"));
  try {
    const jsonPath = path.join(tempRoot, "measures.json");
    const run = await runScript([localRepoPath, "--json", jsonPath]);
    if (run.code === 124) {
      return { failure: info(`Open-track measurement did not finish within ${TIMEOUT_MS / 1000} seconds.`) };
    }
    if (run.code === NOTHING_TO_MEASURE) {
      return {
        failure: info("No source code in a supported language (PHP, JavaScript, TypeScript, Vue, Python) was found to rate."),
      };
    }
    if (run.code !== 0) {
      return {
        failure: info(
          "Open-track measurement could not run. It needs python3 with lizard 1.24.3.",
          run.stderr.trim().split(/\r?\n/).slice(-3)
        ),
      };
    }
    const measures = JSON.parse(await readFile(jsonPath, "utf8")) as OpenTrackScriptMeasures;
    return { input: openTrackInput(measures), skippedFiles: measures.skipped_files?.length ?? 0 };
  } catch (error) {
    return { failure: info(`Open-track measures could not be read: ${(error as Error).message}`) };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

/**
 * The open-track measures other checks put on their results, read by shape:
 * `openTrack.duplication.percentage` (0 to 100, all languages) becomes the
 * duplication share.
 */
export function openTrackExtras(results: ReadonlyArray<object>): OpenTrackInput {
  const shares: Record<string, number> = {};
  const histograms: Record<string, Histogram> = {};
  for (const result of results) {
    const openTrack = (result as { openTrack?: { duplication?: { percentage?: unknown }; coupling?: unknown } }).openTrack;
    const percentage = openTrack?.duplication?.percentage;
    if (typeof percentage === "number" && Number.isFinite(percentage)) shares.duplication = percentage / 100;
    const coupling = pooledCoupling(openTrack?.coupling);
    if (coupling?.histogram) histograms.module_coupling = coupling.histogram;
    if (coupling) {
      shares.component_independence = coupling.independence;
      shares.component_entanglement = coupling.entanglement;
    }
  }
  return Object.keys(histograms).length > 0 ? { shares, histograms } : { shares };
}

interface CouplingLanguage {
  measured?: boolean;
  loc?: number;
  componentIndependence?: number;
  componentEntanglement?: { violationDegree?: number };
  moduleCoupling?: { fanInHistogram?: Histogram };
}

/**
 * The coupling check's languages pooled as the benchmark pools them: the
 * fan-in histograms added up, independence and entanglement averaged with each
 * language's code lines. Null when a language was not measured; no histogram
 * when a language reports none.
 */
function pooledCoupling(raw: unknown): { histogram?: Histogram; independence: number; entanglement: number } | null {
  const languages = Object.values((raw as { languages?: Record<string, CouplingLanguage> } | undefined)?.languages ?? {});
  if (languages.length === 0 || languages.some((language) => language.measured !== true)) return null;
  let loc = 0;
  let independence = 0;
  let entanglement = 0;
  let histogram: Histogram | undefined = {};
  for (const language of languages) {
    const lines = language.loc;
    const hidden = language.componentIndependence;
    const degree = language.componentEntanglement?.violationDegree;
    if (typeof lines !== "number" || typeof hidden !== "number" || typeof degree !== "number") return null;
    loc += lines;
    independence += hidden * lines;
    entanglement += degree * lines;
    const fanIn = language.moduleCoupling?.fanInHistogram;
    if (!fanIn || !histogram) {
      histogram = undefined;
      continue;
    }
    for (const [value, moduleLoc] of Object.entries(fanIn)) histogram[value] = (histogram[value] ?? 0) + moduleLoc;
  }
  if (loc <= 0) return null;
  return { histogram, independence: independence / loc, entanglement: entanglement / loc };
}

/** Rates a measurement; a field in `extra` replaces the script's own. */
export function rateOpenTrack(measurement: OpenTrackMeasurement, extra: OpenTrackInput = {}): CheckResult {
  if ("failure" in measurement) return measurement.failure;
  const { input, skippedFiles } = measurement;
  return mapOpenTrack(
    {
      histograms: { ...input.histograms, ...extra.histograms },
      shares: { ...input.shares, ...extra.shares },
    },
    OPEN_TRACK_THRESHOLDS,
    skippedFiles
  );
}

/** Rates every result with id `opentrack` again, with the open-track measures of the other results. */
export function withOpenTrackExtras<T extends CheckResult>(results: T[], measurement: OpenTrackMeasurement): T[] {
  const extra = openTrackExtras(results.filter((result) => result.id !== BASE_RESULT.id));
  return results.map((result) => (result.id === BASE_RESULT.id ? ({ ...result, ...rateOpenTrack(measurement, extra) } as T) : result));
}

/** Measures the repository with the open-track script and rates it. */
export async function checkOpenTrack(localRepoPath?: string, extra: OpenTrackInput = {}): Promise<CheckResult> {
  return rateOpenTrack(await measureOpenTrack(localRepoPath), extra);
}
