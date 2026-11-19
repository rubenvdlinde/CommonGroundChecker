/**
 * The configuration of the static site: the followed repositories in
 * config/repositories.yml and the SLAs in config/slas.yml. Both are changed
 * by pull request and checked against the JSON schemas in config/schema.
 */
import yaml from "js-yaml";

/** Where the checker finds deployment and documentation files it would not find on its own. */
export interface RepositoryHints {
  helm?: string[];
  docker?: string[];
  docs?: string[];
  apiSpecs?: string[];
}

export interface RetiredInfo {
  /** YYYY-MM-DD */
  on: string;
  reason: string;
}

export const PROVIDER_SERVICES = ["maintenance", "support", "hosting", "implementation", "training"] as const;
export type ProviderService = (typeof PROVIDER_SERVICES)[number];

export const SERVICE_LABELS: Record<ProviderService, string> = {
  maintenance: "Maintenance",
  support: "Support",
  hosting: "Hosting",
  implementation: "Implementation",
  training: "Training",
};

/** An organisation that offers services on top of a component. It adds itself by pull request. */
export interface ServiceProvider {
  name: string;
  services: ProviderService[];
  url?: string;
  /** A general address such as info@example.nl; no personal data */
  contact?: string;
  /** YYYY-MM-DD */
  since?: string;
}

export interface FollowedRepository {
  url: string;
  /** Listed in the Common Ground basisset (code.overheid.nl/CommonGround/vcg-basisset) */
  basisset?: boolean;
  /** What to scan: latest-release, default-branch, or a branch or tag name. Default: the checker's default. */
  scanRef?: string;
  /** The component is a register: its API specification is checked as one. */
  register?: boolean;
  hints?: RepositoryHints;
  /** Issue labels that mark an issue as covered by an SLA */
  slaLabels?: string[];
  /** A retired component is no longer scanned; its last results stay listed. */
  retired?: RetiredInfo;
  /** Who offers services on top of the component; contracts and SLAs are in config/slas.yml */
  providers?: ServiceProvider[];
  /** Ids of config/functionalities.yml: what the component does */
  functionalities?: string[];
  /** True while the component owner has not confirmed the functionalities */
  functionalitiesDraft?: boolean;
}

export interface RepositoriesConfig {
  repositories: FollowedRepository[];
}

export interface SlaEntry {
  repository: string;
  /** Who agreed the SLA, for example VNG */
  party: string;
  /** The organisation that maintains the component under the SLA */
  maintainer: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  until: string;
  link?: string;
}

export interface SlasConfig {
  slas: SlaEntry[];
}

/** js-yaml reads an unquoted 2026-01-01 as a Date; the config keeps dates as YYYY-MM-DD text. */
const YAML_SCHEMA = yaml.JSON_SCHEMA;

export function parseYaml(text: string): unknown {
  return yaml.load(text, { schema: YAML_SCHEMA }) ?? {};
}

/** The URL as the checker and the data files key it: no trailing slash, no `.git`, lower-case host. */
export function normalizeRepositoryUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = "";
  url.search = "";
  const pathname = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
  return `${url.protocol}//${url.host.toLowerCase()}${pathname}`;
}

export interface RepositoryPath {
  host: string;
  owner: string;
  repo: string;
}

/**
 * Host, owner and name of a repository URL. On GitLab the owner is the full
 * group path, so https://gitlab.com/a/b/c has owner `a/b` and name `c`.
 */
export function repositoryPath(raw: string): RepositoryPath {
  const url = new URL(normalizeRepositoryUrl(raw));
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) throw new Error(`Not a repository URL: ${raw}`);
  return {
    host: url.host,
    owner: segments.slice(0, -1).join("/"),
    repo: segments[segments.length - 1],
  };
}

/** The data directory of a repository, relative to the data root: repositories/<host>/<owner>/<repo>. */
export function repositoryDataDir(path: RepositoryPath): string {
  return ["repositories", path.host, ...path.owner.split("/"), path.repo].join("/");
}

/** The id the static site gives a repository: <host>/<owner>/<repo>. */
export function repositoryId(path: RepositoryPath): string {
  return `${path.host}/${path.owner}/${path.repo}`;
}

/** The repository URLs listed more than once, compared after normalising. */
export function duplicateRepositories(config: RepositoriesConfig): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of config.repositories) {
    const key = normalizeRepositoryUrl(entry.url).toLowerCase();
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

/** The SLAs of one repository, keyed by its normalised URL. */
export function slasByRepository(config: SlasConfig): Map<string, SlaEntry[]> {
  const result = new Map<string, SlaEntry[]>();
  for (const sla of config.slas) {
    const key = normalizeRepositoryUrl(sla.repository).toLowerCase();
    result.set(key, [...(result.get(key) ?? []), sla]);
  }
  return result;
}
