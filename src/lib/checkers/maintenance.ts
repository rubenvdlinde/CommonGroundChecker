import yaml from "js-yaml";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { findPubliccodeFile } from "./publiccode";

const BASE_RESULT = {
  id: "maintenance",
  title: "Maintenance contract",
  description:
    "The component has a valid maintenance contract: publiccode.yml names a contractor whose contract has not ended.",
  referenceUrl: "https://publiccodeyml.github.io/v0/schema.core.html#section-maintenance",
} as const;

function result(status: CheckResult["status"], message: string, evidence: string[] = []): CheckResult {
  return { ...BASE_RESULT, status, message, evidence };
}

function fail(message: string, evidence: string[] = []): CheckResult {
  return result("fail", message, evidence);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A YAML date, which js-yaml may already have turned into a Date, as YYYY-MM-DD; null when it is not a date. */
function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const date = new Date(`${value.trim()}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value.trim()) return value.trim();
  }
  return null;
}

interface ContractorCheck {
  label: string;
  until: string | null;
  problems: string[];
}

/** What is wrong with one entry of maintenance.contractors on `today`; no problems means a current contract. */
function checkContractor(entry: unknown, index: number, today: string): ContractorCheck {
  const contractor = record(entry);
  const name = typeof contractor?.name === "string" && contractor.name.trim() !== "" ? contractor.name.trim() : null;
  const label = name ?? `contractor ${index + 1}`;
  const problems: string[] = [];
  if (!contractor) {
    return { label, until: null, problems: ["is not a contractor entry"] };
  }
  if (!name) problems.push("has no name");

  const until = isoDate(contractor.until);
  if (contractor.until === undefined || contractor.until === null) {
    problems.push("has no end date (until)");
  } else if (!until) {
    problems.push(`has an end date that is not a date: "${String(contractor.until)}"`);
  } else if (until < today) {
    problems.push(`ended on ${until}`);
  }

  if (contractor.email !== undefined && (typeof contractor.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contractor.email))) {
    problems.push(`has an invalid email address: "${String(contractor.email)}"`);
  }
  return { label, until, problems };
}

function sentence(text: string): string {
  return text.replace(/\.?$/, ".");
}

/** Judges the `maintenance` section of a parsed publiccode.yml on `today` (YYYY-MM-DD). */
export function judgeMaintenance(publiccode: unknown, file: string, today: string): CheckResult {
  const maintenance = record(record(publiccode)?.maintenance);
  if (!maintenance) {
    return fail(`${file} has no maintenance section, so there is no maintenance contract.`, [file]);
  }

  const type = maintenance.type;
  if (type === "none") {
    return fail(`${file} declares maintenance.type none: nobody maintains the component.`, [file]);
  }
  if (type === "internal" || type === "community") {
    return fail(`${file} declares maintenance.type ${type}: there is no maintenance contract.`, [file]);
  }
  if (typeof type !== "string") {
    return fail(`${file} does not declare maintenance.type, so there is no maintenance contract.`, [file]);
  }
  if (type !== "contract") {
    return fail(`${file} declares maintenance.type "${type}", which is not a known type: there is no maintenance contract.`, [file]);
  }

  if (!Array.isArray(maintenance.contractors) || maintenance.contractors.length === 0) {
    return fail(`${file} declares maintenance under contract, but names no contractor.`, [file]);
  }

  const checks = maintenance.contractors.map((entry, index) => checkContractor(entry, index, today));
  const evidence = checks.map((check) =>
    check.problems.length === 0 ? `${check.label}: valid until ${check.until}` : `${check.label}: ${check.problems.join(", ")}`
  );
  const valid = checks.filter((check) => check.problems.length === 0);

  if (valid.length === 0) {
    const reasons = checks.map((check) => `${check.label} ${check.problems.join(" and ")}`).join("; ");
    return fail(sentence(`No valid maintenance contract: ${reasons}`), evidence);
  }

  const contracts = valid.map((check) => `${check.label} until ${check.until}`).join(", ");
  const invalid = checks.length - valid.length;
  return result(
    "pass",
    `Maintenance contract with ${contracts}.` +
      (invalid > 0 ? ` ${invalid} other contractor ${invalid === 1 ? "entry is" : "entries are"} not valid; see the evidence.` : ""),
    evidence
  );
}

export async function checkMaintenance(context: RepoContext, tree: string[], today = new Date()): Promise<CheckResult> {
  const file = findPubliccodeFile(tree);
  if (!file) {
    return fail("No publiccode.yml was found, so there is no maintenance contract.");
  }

  const content = await context.provider.getFileContent(context, file);
  if (!content) {
    return result("warn", `Found ${file} but could not read its contents, so the maintenance contract was not checked.`, [file]);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch {
    return fail(`${file} is not valid YAML, so it declares no maintenance contract that can be read.`, [file]);
  }
  return judgeMaintenance(parsed, file, today.toISOString().slice(0, 10));
}
