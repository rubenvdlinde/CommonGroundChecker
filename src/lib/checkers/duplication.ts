import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPythonScript, TIMED_OUT } from "./pythonScript";
import type { CheckResult, OpenTrackClone, OpenTrackDuplication } from "../types";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "maintainability", "open_duplication.py");
const TIMEOUT_MS = (Number(process.env.DUPLICATION_TIMEOUT_SECONDS) || 600) * 1000;
/** Exit status of the script when no file in a supported language is in scope. */
const NOTHING_TO_JUDGE = 4;
const SHOWN_CLONES = 5;

interface MeasuredLanguage {
  files: number;
  lines: number;
  duplicatedLines: number;
  clones: number;
  percentage: number;
}

interface UnmeasuredLanguage {
  files: number;
  notMeasured: string;
}

/** The script's JSON report. */
export interface OpenDuplicationReport {
  tool: string;
  version: string;
  files: number;
  languages: Record<string, MeasuredLanguage | UnmeasuredLanguage>;
  overall: { lines: number; duplicatedLines: number; percentage: number } | null;
  largestClones: OpenTrackClone[];
}

const BASE_RESULT = {
  id: "duplication",
  title: "Duplication (open track)",
  description:
    "Duplicated lines per language as jscpd reports them, over the production code the maintainability estimate rates. Informative: the raw figures are shown here and rated by \"Maintainability, open track\" when that rating is available.",
  referenceUrl: "https://github.com/kucherenko/jscpd",
} as const;

function warn(message: string, evidence: string[] = []): CheckResult {
  return { ...BASE_RESULT, status: "warn", message, evidence };
}

function isMeasured(language: MeasuredLanguage | UnmeasuredLanguage): language is MeasuredLanguage {
  return !("notMeasured" in language);
}

function languageLine(name: string, language: MeasuredLanguage | UnmeasuredLanguage): string {
  if (!isMeasured(language)) {
    return `${name}: not measured: ${language.notMeasured}`;
  }
  return `${name}: ${language.percentage.toFixed(1)}% (${language.duplicatedLines} of ${language.lines} lines, ${language.clones} clone(s) in ${language.files} file(s))`;
}

function cloneLine(clone: OpenTrackClone): string {
  return `Clone of ${clone.lines} lines: ${clone.file}:${clone.startLine}-${clone.endLine} and ${clone.otherFile}:${clone.otherStartLine}-${clone.otherEndLine}`;
}

/** Turns the script's JSON report into an informative check result. */
export function mapOpenDuplicationReport(report: OpenDuplicationReport): CheckResult {
  const entries = Object.entries(report.languages);
  const duplication: OpenTrackDuplication = {
    tool: `${report.tool} ${report.version}`,
    percentage: report.overall?.percentage ?? null,
    languages: Object.fromEntries(
      entries.map(([name, language]) => [name, isMeasured(language) ? language.percentage : null])
    ),
    largestClones: report.largestClones,
  };
  const perLanguage = entries
    .map(([name, language]) => `${name} ${isMeasured(language) ? `${language.percentage.toFixed(1)}%` : "not measured"}`)
    .join(", ");
  const overall = report.overall
    ? `${report.overall.percentage.toFixed(1)}% overall`
    : "no overall figure, because a language was not measured";

  return {
    ...BASE_RESULT,
    status: report.overall ? "info" : "warn",
    message: `${duplication.tool} duplicated lines: ${overall} (${perLanguage}) over ${report.files} file(s). Shown for information; it does not count towards the score.`,
    evidence: [
      ...entries.map(([name, language]) => languageLine(name, language)),
      ...report.largestClones.slice(0, SHOWN_CLONES).map(cloneLine),
    ],
    openTrack: { duplication },
  };
}

export async function checkDuplication(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return warn("The repository could not be cloned, so duplication was not measured.");
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-duplication-"));
  try {
    const jsonPath = path.join(tempRoot, "report.json");
    const run = await runPythonScript(SCRIPT_PATH, [localRepoPath, "--json", jsonPath], TIMEOUT_MS);
    if (run.code === TIMED_OUT) {
      return warn(`Duplication was not measured: jscpd did not finish within ${TIMEOUT_MS / 1000} seconds.`);
    }
    if (run.code === NOTHING_TO_JUDGE) {
      return { ...BASE_RESULT, status: "info", message: "No source code in a supported language was found to measure." };
    }
    if (run.code !== 0) {
      return warn(
        "Duplication was not measured. It needs python3 and jscpd 5.4.2.",
        run.stderr.trim().split(/\r?\n/).slice(-3)
      );
    }
    const report = JSON.parse(await readFile(jsonPath, "utf8")) as OpenDuplicationReport;
    return mapOpenDuplicationReport(report);
  } catch (error) {
    return warn(`Duplication report could not be read: ${(error as Error).message}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
