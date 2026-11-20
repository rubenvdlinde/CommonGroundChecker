import path from "node:path";
import { spawn } from "node:child_process";
import {
  QSM_LINES_PER_FUNCTION_POINT,
  SIG_V17_LINES_PER_PERSON_YEAR,
  formatCount,
  formatPersonYears,
  proxyNote,
  sizeEstimates,
  sizeFromScc,
  type SccLanguage,
} from "../size";
import type { CheckResult, SizeMeasurement } from "../types";

export const SCC_VERSION = "4.1.0";
const SCOPE_SCRIPT = path.join(process.cwd(), "scripts", "size", "scope.py");
const TIMEOUT_MS = (Number(process.env.SIZE_TIMEOUT_SECONDS) || 300) * 1000;
/** scc's JSON for a 3.5 million line repository is about 10 MB. */
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

/**
 * scc on the whole checkout, one entry per file. Ignore files are disabled
 * because the scope comes from the tracked files; minified and generated
 * files are left out.
 */
const SCC_ARGS = ["--by-file", "--format", "json", "--no-cocomo", "--no-size", "--no-gitignore", "--no-ignore", "--no-min-gen", "."];

const BASE_RESULT = {
  id: "size",
  title: "Size",
  description:
    "Counts the lines of production code per language and estimates the effort to rebuild it. Informative, not rated.",
  referenceUrl: "https://github.com/boyter/scc",
  requirementLevel: "informative",
} as const;

function notMeasured(reason: string, evidence: string[] = []): CheckResult {
  return { ...BASE_RESULT, status: "info", message: `Not measured: ${reason}`, evidence };
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], cwd?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) child.kill("SIGKILL");
      else stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: error.message });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: signal ? 124 : code ?? 1, stdout, stderr });
    });
  });
}

function lastLines(text: string): string[] {
  return text.trim().split(/\r?\n/).filter(Boolean).slice(-3);
}

/** Turns the measured lines per language into a check result. */
export function mapSize(size: SizeMeasurement): CheckResult {
  if (size.loc === 0) {
    return notMeasured("no production code in a counted language was found.");
  }
  const estimates = sizeEstimates(size);
  const backfiringNote = proxyNote(estimates.backfiringProxies, QSM_LINES_PER_FUNCTION_POINT);
  const sigNote = proxyNote(estimates.sigStyleProxies, SIG_V17_LINES_PER_PERSON_YEAR);
  const evidence = size.languages.map(
    (language) => `${language.language}: ${formatCount(language.loc)} lines in ${formatCount(language.files)} file(s)`
  );
  evidence.push(
    `Rebuild effort, open estimate: ${formatCount(estimates.functionPoints)} function points, ${formatPersonYears(estimates.rebuildPersonYears)}` +
      (backfiringNote ? ` (proxies: ${backfiringNote})` : "")
  );
  evidence.push(
    `SIG-style volume, context, not part of the 2026 rating: ${formatPersonYears(estimates.sigStylePersonYears)}` +
      (sigNote ? ` (proxies: ${sigNote})` : "")
  );
  if (estimates.unmodelledLoc > 0) {
    evidence.push(`${formatCount(estimates.unmodelledLoc)} lines are in a language without an effort factor and are left out of both estimates`);
  }
  return {
    ...BASE_RESULT,
    status: "info",
    size,
    message:
      `${formatCount(size.loc)} lines of production code in ${formatCount(size.files)} file(s), counted with ${size.tool}. ` +
      `Rebuild effort about ${formatPersonYears(estimates.rebuildPersonYears)} (open estimate).`,
    evidence,
  };
}

export async function checkSize(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return notMeasured("the repository could not be cloned.");
  }

  const scope = await run("python3", [SCOPE_SCRIPT, localRepoPath]);
  if (scope.code === 124) return notMeasured(`the scope was not listed within ${TIMEOUT_MS / 1000} seconds.`);
  if (scope.code !== 0) return notMeasured("the production scope could not be listed.", lastLines(scope.stderr));

  const scc = await run("scc", SCC_ARGS, localRepoPath);
  if (scc.code === 124) return notMeasured(`scc did not finish within ${TIMEOUT_MS / 1000} seconds or its output was too large.`);
  if (scc.code !== 0) {
    return notMeasured(`scc ${SCC_VERSION} could not run.`, lastLines(scc.stderr));
  }

  try {
    const files = JSON.parse(scope.stdout) as string[];
    const languages = JSON.parse(scc.stdout) as SccLanguage[];
    return mapSize(sizeFromScc(languages, files, `scc ${SCC_VERSION}`));
  } catch (error) {
    return notMeasured(`the scc output could not be read: ${(error as Error).message}`);
  }
}
