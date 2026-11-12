import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPythonScript, TIMED_OUT } from "./pythonScript";
import type { CheckResult } from "../types";
import { formatStars, ratingToStars } from "../stars";

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
  rating: {
    overall: { range: [number, number] } | null;
    properties: Record<string, { rating: number | null; languages: Record<string, RatedLanguage> }>;
    levers?: Lever[];
  };
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

/** Turns the script's JSON report into a check result. */
export function mapMaintainabilityReport(report: MaintainabilityReport): CheckResult {
  const overall = report.rating.overall;
  if (!overall) {
    return warn(NO_SOURCE_MESSAGE);
  }

  const [low, high] = overall.range;
  const rating = (low + high) / 2;
  const starRating = ratingToStars(rating);
  const status = starRating >= 4 ? "pass" : starRating === 3 ? "warn" : "fail";

  const evidence = Object.entries(report.rating.properties)
    .filter(([, property]) => property.rating !== null)
    .map(([key, property]) => propertyLine(key, property.rating!, property.languages));
  evidence.push(...(report.rating.levers ?? []).slice(0, 3).map(leverLine));
  if (report.skipped_files?.length) {
    evidence.push(`Skipped ${report.skipped_files.length} file(s) the analyser could not read`);
  }

  return {
    ...BASE_RESULT,
    status,
    starRating,
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
