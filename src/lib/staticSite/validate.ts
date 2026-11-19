/**
 * Checks of config/repositories.yml and config/slas.yml: the JSON schemas,
 * then rules a schema cannot express (no duplicates, SLAs on listed
 * repositories, dates that exist), then for new or changed entries whether
 * the repository is public and has a publiccode.yml.
 */
import Ajv from "ajv";
import repositoriesSchema from "../../../config/schema/repositories.schema.json";
import slasSchema from "../../../config/schema/slas.schema.json";
import {
  duplicateRepositories,
  normalizeRepositoryUrl,
  repositoryPath,
  type FollowedRepository,
  type RepositoriesConfig,
  type SlasConfig,
} from "./config";
import { readTaxonomy, taxonomyProblems } from "../functionalities/taxonomy";

export interface Finding {
  level: "error" | "warning";
  /** The repository URL or file the finding is about */
  subject: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true });
const validateRepositories = ajv.compile(repositoriesSchema);
const validateSlas = ajv.compile(slasSchema);

function schemaFindings(subject: string, errors: typeof validateRepositories.errors): Finding[] {
  return (errors ?? []).map((error) => ({
    level: "error",
    subject,
    message: `${error.instancePath || "/"} ${error.message ?? "is invalid"}${
      error.params && "allowedValues" in error.params ? `: ${(error.params.allowedValues as string[]).join(", ")}` : ""
    }`,
  }));
}

function isDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Findings that need no network. With the parsed config/functionalities.yml,
 * every functionality a component names must be in it; without it they are not checked.
 */
export function checkConfig(repositories: unknown, slas: unknown, functionalities?: unknown): Finding[] {
  const findings: Finding[] = [];
  if (!validateRepositories(repositories)) findings.push(...schemaFindings("config/repositories.yml", validateRepositories.errors));
  if (!validateSlas(slas)) findings.push(...schemaFindings("config/slas.yml", validateSlas.errors));
  const taxonomy = functionalities === undefined ? null : readTaxonomy(functionalities);
  if (taxonomy) {
    if (taxonomy.functionalities.length === 0) {
      findings.push({ level: "error", subject: "config/functionalities.yml", message: "Lists no functionalities." });
    }
    for (const problem of taxonomyProblems(taxonomy)) {
      findings.push({ level: "error", subject: "config/functionalities.yml", message: problem });
    }
  }
  if (findings.length > 0) return findings;
  const known = taxonomy ? new Set(taxonomy.functionalities.map((functionality) => functionality.id)) : null;

  const repoConfig = repositories as RepositoriesConfig;
  const slaConfig = slas as SlasConfig;
  for (const url of duplicateRepositories(repoConfig)) {
    findings.push({ level: "error", subject: url, message: "Listed more than once in config/repositories.yml." });
  }

  const listed = new Set(repoConfig.repositories.map((entry) => normalizeRepositoryUrl(entry.url).toLowerCase()));
  for (const entry of repoConfig.repositories) {
    try {
      repositoryPath(entry.url);
    } catch {
      findings.push({ level: "error", subject: entry.url, message: "Not a repository URL: expected https://<host>/<owner>/<name>." });
    }
    for (const day of [entry.retired?.on, ...(entry.providers ?? []).map((provider) => provider.since)]) {
      if (day && !isDay(day)) findings.push({ level: "error", subject: entry.url, message: `${day} is not a date.` });
    }
    for (const id of known ? entry.functionalities ?? [] : []) {
      if (!known?.has(id)) {
        findings.push({ level: "error", subject: entry.url, message: `Functionality ${id} is not in config/functionalities.yml.` });
      }
    }
    if (entry.functionalitiesDraft && !(entry.functionalities ?? []).length) {
      findings.push({ level: "warning", subject: entry.url, message: "functionalitiesDraft is set, but no functionalities are listed." });
    }
    const providerNames = (entry.providers ?? []).map((provider) => provider.name.trim().toLowerCase());
    if (new Set(providerNames).size !== providerNames.length) {
      findings.push({ level: "error", subject: entry.url, message: "A provider is listed more than once." });
    }
  }
  for (const sla of slaConfig.slas) {
    if (!listed.has(normalizeRepositoryUrl(sla.repository).toLowerCase())) {
      findings.push({ level: "error", subject: sla.repository, message: "SLA on a repository that is not in config/repositories.yml." });
    }
    for (const day of [sla.start, sla.until]) {
      if (!isDay(day)) findings.push({ level: "error", subject: sla.repository, message: `${day} is not a date.` });
    }
    if (sla.until < sla.start) findings.push({ level: "error", subject: sla.repository, message: "The SLA ends before it starts." });
  }
  return findings;
}

/** The entries that are new or changed compared with the base version of the list. */
export function changedEntries(current: RepositoriesConfig, base: RepositoriesConfig | null): FollowedRepository[] {
  if (!base) return current.repositories;
  const before = new Map(
    base.repositories.map((entry) => [normalizeRepositoryUrl(entry.url).toLowerCase(), JSON.stringify(entry)])
  );
  return current.repositories.filter(
    (entry) => before.get(normalizeRepositoryUrl(entry.url).toLowerCase()) !== JSON.stringify(entry)
  );
}

export interface RemoteChecks {
  /** Whether anyone can read the repository without credentials */
  isPublic(url: string): Promise<boolean>;
  /** The publiccode file found at the top of the default branch, null when there is none, undefined when not checked */
  publiccodeFile(url: string): Promise<string | null | undefined>;
}

/** Findings for entries that need the network: public and reachable (error), publiccode.yml present (warning). */
export async function checkRemote(entries: FollowedRepository[], remote: RemoteChecks): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const entry of entries) {
    if (entry.retired) continue;
    if (!(await remote.isPublic(entry.url))) {
      findings.push({ level: "error", subject: entry.url, message: "The repository is not public or cannot be reached." });
      continue;
    }
    const file = await remote.publiccodeFile(entry.url);
    if (file === null) {
      findings.push({
        level: "warning",
        subject: entry.url,
        message: "No publiccode.yml or publiccode.yaml at the top of the default branch. It is scanned, but scores lower.",
      });
    } else if (file === undefined) {
      findings.push({ level: "warning", subject: entry.url, message: "publiccode.yml not checked on this host." });
    }
  }
  return findings;
}
