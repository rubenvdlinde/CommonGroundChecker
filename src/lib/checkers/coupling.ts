import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPythonScript, TIMED_OUT } from "./pythonScript";
import type { CheckResult, CouplingMeasures, MeasuredCoupling } from "../types";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "coupling", "check_coupling.py");
const TIMEOUT_SECONDS = Number(process.env.COUPLING_TIMEOUT_SECONDS) || 600;
/** Seconds the script keeps back from its own tool time limit to write the report. */
const REPORT_MARGIN_SECONDS = 20;
/** Exit status of the script when no file in a supported language is in scope. */
const NOTHING_TO_MEASURE = 4;
const REFERENCE_URL = "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/sig-quality-models.md";

const LANGUAGE_LABELS: Record<string, string> = {
  php: "PHP",
  python: "Python",
  javascript: "JavaScript, TypeScript and Vue",
};

const BASE_RESULT = {
  id: "coupling",
  title: "Coupling (open track)",
  description:
    "Measures module coupling, component independence, component entanglement and dependency cycles from the module dependency graph of pdepend (PHP), grimp (Python) and dependency-cruiser (JavaScript, TypeScript, Vue).",
  referenceUrl: REFERENCE_URL,
} as const;

function info(message: string, evidence: string[] = [], coupling?: CouplingMeasures): CheckResult {
  return { ...BASE_RESULT, status: "info", message, evidence, ...(coupling ? { openTrack: { coupling } } : {}) };
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function measuredLine(label: string, language: MeasuredCoupling): string {
  const profile = language.moduleCoupling.riskProfile;
  const entanglement = language.componentEntanglement;
  const cycles = language.cycles;
  return (
    `${label} (${language.tool}): ${count(language.modules)} modules, ${count(language.edges)} edges, ` +
    `${language.components} components; independence ${percent(language.componentIndependence)}, ` +
    `entanglement ${entanglement.violationDegree.toFixed(3)} (density ${entanglement.density.toFixed(2)}); ` +
    `fan-in profile ${percent(profile.low)} / ${percent(profile.moderate)} / ${percent(profile.high)} / ` +
    `${percent(profile.veryHigh)} of code at 0-10 / 11-20 / 21-50 / over 50; ` +
    `${count(cycles.modulesInCycles)} modules in ${count(cycles.moduleCycles)} cycles, ` +
    `largest component cycle ${cycles.largestComponentCycle}`
  );
}

function contractsLine(label: string, language: MeasuredCoupling): string | null {
  const contracts = language.contracts;
  if (!contracts) return null;
  if ("error" in contracts) return `${label} import-linter contracts not checked: ${contracts.error}`;
  return `${label} import-linter contracts: ${contracts.kept} kept, ${contracts.broken} broken`;
}

/** Turns the script's JSON report into an informative check result that carries the raw values. */
export function mapCouplingReport(report: CouplingMeasures): CheckResult {
  const entries = Object.entries(report.languages);
  if (entries.length === 0) {
    return info("No source code in a supported language (PHP, Python, JavaScript, TypeScript, Vue) was found to measure.");
  }

  const evidence: string[] = [];
  const measured: string[] = [];
  const unmeasured: string[] = [];
  for (const [key, language] of entries) {
    const label = LANGUAGE_LABELS[key] ?? key;
    if (!language.measured) {
      unmeasured.push(label);
      evidence.push(`${label}: not measured: ${language.reason}`);
      continue;
    }
    measured.push(label);
    evidence.push(measuredLine(label, language));
    evidence.push(`${label} components: ${language.componentDefinition}${language.scope ? `; ${language.scope}` : ""}`);
    const contracts = contractsLine(label, language);
    if (contracts) evidence.push(contracts);
  }

  const parts = [];
  if (measured.length) parts.push(`Measured the module structure of ${measured.join(", ")}.`);
  if (unmeasured.length) parts.push(`Not measured: ${unmeasured.join(", ")}.`);
  parts.push('The raw figures are shown here and rated by "Maintainability, open track" when that rating is available.');
  return info(parts.join(" "), evidence, report);
}

export async function checkCoupling(localRepoPath?: string): Promise<CheckResult> {
  if (!localRepoPath) {
    return info("The repository could not be cloned, so coupling was not measured.");
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cgchecker-coupling-"));
  try {
    const jsonPath = path.join(tempRoot, "report.json");
    const toolSeconds = Math.max(1, TIMEOUT_SECONDS - REPORT_MARGIN_SECONDS);
    const run = await runPythonScript(
      SCRIPT_PATH,
      [localRepoPath, "--json", jsonPath, "--time-limit", String(toolSeconds)],
      TIMEOUT_SECONDS * 1000
    );
    if (run.code === TIMED_OUT) {
      return info(`Coupling analysis did not finish within ${TIMEOUT_SECONDS} seconds.`);
    }
    if (run.code === NOTHING_TO_MEASURE) {
      return mapCouplingReport({ version: 1, languages: {} });
    }
    if (run.code !== 0) {
      return info(
        "Coupling analysis could not run. It needs python3 with grimp 3.18, pdepend 3.0.0 and dependency-cruiser 17.4.3.",
        run.stderr.trim().split(/\r?\n/).slice(-3)
      );
    }
    const report = JSON.parse(await readFile(jsonPath, "utf8")) as CouplingMeasures;
    return mapCouplingReport(report);
  } catch (error) {
    return info(`Coupling report could not be read: ${(error as Error).message}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
