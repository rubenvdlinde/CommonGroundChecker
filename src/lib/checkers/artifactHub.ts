import yaml from "js-yaml";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { findPubliccodeFile } from "./publiccode";

export const DEFAULT_ARTIFACT_HUB_URL = "https://artifacthub.io";

/** Artifact Hub does not scan a version with more images than this. */
export const MAX_SCANNED_IMAGES = 15;

/** Artifact Hub does not scan a version released longer ago than this. */
const MAX_SCANNED_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 20_000;
const SEARCH_LIMIT = 60;
const MAX_SEARCH_TERMS = 4;
const MAX_CANDIDATES = 8;

const SEVERITIES = ["critical", "high", "medium", "low", "unknown"] as const;
type Severity = (typeof SEVERITIES)[number];
export type SeverityCounts = Record<Severity, number>;

const DOCKER_FILES = ["dockerfile", "dockerfile.dev", "dockerfile.prod", "dockerfile.local"];
const README_FILES = ["readme.md", "readme.rst", "readme.txt", "readme"];

const BASE_RESULT = {
  id: "artifacthub",
  title: "Helm chart on Artifact Hub, images scanned",
  description:
    "A container component registers its Helm chart on Artifact Hub, which scans the chart's container images with Trivy. The latest version must have no critical vulnerabilities.",
  referenceUrl: "https://artifacthub.io/docs/topics/security_report/",
} as const;

function result(
  status: CheckResult["status"],
  message: string,
  evidence: string[] = [],
  referenceUrl: string = BASE_RESULT.referenceUrl
): CheckResult {
  return { ...BASE_RESULT, status, message, evidence, referenceUrl };
}

function notMeasured(reason: string, evidence: string[], referenceUrl?: string): CheckResult {
  return result("warn", `Not measured: ${reason}`, evidence, referenceUrl);
}

interface ArtifactHubRepository {
  repository_id?: string;
  name: string;
  url?: string;
  private?: boolean;
  scanner_disabled?: boolean;
}

interface ArtifactHubPackageSummary {
  package_id: string;
  name: string;
  version?: string;
  repository: ArtifactHubRepository;
}

interface ArtifactHubPackage extends ArtifactHubPackageSummary {
  version: string;
  /** Release time of the version, in seconds since the epoch */
  ts?: number;
  home_url?: string | null;
  content_url?: string | null;
  links?: Array<{ name?: string; url?: string }> | null;
  containers_images?: Array<{ image?: string; whitelisted?: boolean }> | null;
  all_containers_images_whitelisted?: boolean;
  security_report_summary?: Partial<SeverityCounts> | null;
  /** Time of the latest scan, in seconds since the epoch */
  security_report_created_at?: number | null;
}

/** Trivy output per image, as Artifact Hub serves it. */
type SecurityReport = Record<
  string,
  { Results?: Array<{ Vulnerabilities?: Array<{ Severity?: string }> | null }> | null }
>;

export interface ImageScan {
  image: string;
  counts: SeverityCounts;
}

export interface CheckArtifactHubOptions {
  dockerLocations?: string[];
  helmChartLocations?: string[];
  /** The time the check runs at; decides whether the latest version is still scanned */
  now?: Date;
  /** Base URL of the Artifact Hub instance; defaults to ARTIFACT_HUB_URL or artifacthub.io */
  baseUrl?: string;
}

/** The Artifact Hub instance to use: ARTIFACT_HUB_URL, else artifacthub.io, without a trailing slash. */
export function artifactHubBaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const configured = env.ARTIFACT_HUB_URL?.trim();
  return (configured || DEFAULT_ARTIFACT_HUB_URL).replace(/\/+$/, "");
}

function filename(path: string): string {
  return path.toLowerCase().split("/").pop() ?? "";
}

/**
 * Whether the check applies: to a container component, one with a Dockerfile,
 * a Helm chart or a given image or chart location. A Nextcloud app is never
 * one; it ships as an app, and its dependencies are scanned in the repository.
 */
export function containerComponentReason(
  tree: string[],
  dockerLocations: string[] = [],
  helmChartLocations: string[] = []
): { applies: true; reason: string } | { applies: false; reason: string } {
  const lowerTree = tree.map((path) => path.toLowerCase().replace(/^\/+/, ""));
  if (lowerTree.includes("appinfo/info.xml")) {
    return {
      applies: false,
      reason:
        "this is a Nextcloud app (appinfo/info.xml), not a container component. Its dependencies are covered by the repository dependency scan.",
    };
  }
  const dockerfile = tree.find((path) => DOCKER_FILES.includes(filename(path)));
  if (dockerfile) return { applies: true, reason: `the repository has a Dockerfile (${dockerfile})` };
  const chart = tree.find((path) => filename(path) === "chart.yaml");
  if (chart) return { applies: true, reason: `the repository has a Helm chart (${chart})` };
  if (helmChartLocations.some((value) => value.trim())) return { applies: true, reason: "a Helm chart location was given" };
  if (dockerLocations.some((value) => value.trim())) return { applies: true, reason: "a container image location was given" };
  return {
    applies: false,
    reason:
      "no Dockerfile, Helm chart or container image was found, so this is not a container component. Its dependencies are covered by the repository dependency scan.",
  };
}

/** Helm packages linked as <base>/packages/helm/<repository>/<package> in a text. */
export function findArtifactHubLinks(text: string, baseUrl: string): Array<{ repository: string; name: string }> {
  const hosts = new Set(["artifacthub.io", new URL(baseUrl).host]);
  const links: Array<{ repository: string; name: string }> = [];
  for (const match of text.matchAll(/https?:\/\/([^/\s)"'<>]+)\/packages\/helm\/([^/\s)"'<>#?]+)\/([^/\s)"'<>#?]+)/gi)) {
    const [, host, repository, name] = match;
    if (!hosts.has(host.toLowerCase())) continue;
    if (!links.some((link) => link.repository === repository && link.name === name)) links.push({ repository, name });
  }
  return links;
}

/** The repositoryID in an artifacthub-repo.yml file, or null. */
export function parseArtifactHubRepositoryId(content: string): string | null {
  try {
    const parsed = yaml.load(content) as Record<string, unknown> | null;
    const id = parsed?.repositoryID;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/** The name of a Helm chart, from its Chart.yaml. */
function parseChartName(content: string): string | null {
  try {
    const parsed = yaml.load(content) as Record<string, unknown> | null;
    return typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name.trim() : null;
  } catch {
    return null;
  }
}

function parseUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** The owner and repository a GitHub or GitLab style URL points at, lower case, or null. */
function repositoryOfUrl(value: string | null | undefined): { owner: string; repo: string | null } | null {
  const url = parseUrl(value);
  if (!url) return null;
  const host = url.host.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean).map((part) => part.toLowerCase().replace(/\.git$/, ""));
  if (host.endsWith(".github.io")) {
    return { owner: host.slice(0, -".github.io".length), repo: parts[0] ?? null };
  }
  if (host === "raw.githubusercontent.com" || host === "github.com" || host === "gitlab.com" || host === "www.github.com") {
    return parts.length > 0 ? { owner: parts[0], repo: parts[1] ?? null } : null;
  }
  return null;
}

function packageUrls(pkg: ArtifactHubPackage): Array<{ label: string; url: string }> {
  const urls: Array<{ label: string; url: string }> = [];
  if (pkg.repository.url) urls.push({ label: "chart repository", url: pkg.repository.url });
  for (const link of pkg.links ?? []) if (link.url) urls.push({ label: `${link.name ?? "package"} link`, url: link.url });
  if (pkg.home_url) urls.push({ label: "home page", url: pkg.home_url });
  if (pkg.content_url) urls.push({ label: "download", url: pkg.content_url });
  return urls;
}

interface RepositoryRef {
  owner: string;
  repo: string;
}

interface Match {
  pkg: ArtifactHubPackage;
  strength: number;
  how: string;
}

/** How strongly a package belongs to one of the repositories, and why; null when it does not. */
function matchPackage(
  pkg: ArtifactHubPackage,
  repositories: RepositoryRef[],
  names: string[],
  repositoryId: string | null
): Omit<Match, "pkg"> | null {
  if (repositoryId && pkg.repository.repository_id === repositoryId) {
    return { strength: 3, how: "the repositoryID in artifacthub-repo.yml is the package's Artifact Hub repository" };
  }
  const urls = packageUrls(pkg);
  for (const { label, url } of urls) {
    const target = repositoryOfUrl(url);
    const repository = repositories.find((ref) => target && target.owner === ref.owner && target.repo === ref.repo);
    if (repository) {
      return { strength: 2, how: `the package's ${label} (${url}) points at ${repository.owner}/${repository.repo}` };
    }
  }
  if (!names.includes(pkg.name.toLowerCase())) return null;
  for (const { label, url } of urls) {
    const target = repositoryOfUrl(url);
    if (target && repositories.some((ref) => ref.owner === target.owner)) {
      return {
        strength: 1,
        how: `the package is named ${pkg.name} and its ${label} (${url}) belongs to the same owner, ${target.owner}`,
      };
    }
  }
  return null;
}

/** Counts per severity in the Trivy report of one image. */
export function countSeverities(imageReport: SecurityReport[string] | undefined): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const target of imageReport?.Results ?? []) {
    for (const vulnerability of target.Vulnerabilities ?? []) {
      const severity = String(vulnerability.Severity ?? "").toLowerCase();
      counts[(SEVERITIES as readonly string[]).includes(severity) ? (severity as Severity) : "unknown"] += 1;
    }
  }
  return counts;
}

/** "35 critical, 405 high, 370 medium, 879 low, 1 unknown" */
export function formatCounts(counts: Partial<SeverityCounts>): string {
  return SEVERITIES.map((severity) => `${counts[severity] ?? 0} ${severity}`).join(", ");
}

/** "19 November 2026" */
function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

class ArtifactHubClient {
  constructor(private readonly baseUrl: string) {}

  /** Parsed JSON, or null for a 404 or an empty body. Throws when the request fails. */
  private async get<T>(path: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Artifact Hub answered ${response.status} for ${path}`);
    const text = await response.text();
    return text.trim() ? (JSON.parse(text) as T) : null;
  }

  search(term: string): Promise<{ packages?: ArtifactHubPackageSummary[] } | null> {
    const query = new URLSearchParams({ ts_query_web: term, kind: "0", limit: String(SEARCH_LIMIT) });
    return this.get(`/packages/search?${query.toString()}`);
  }

  helmPackage(repository: string, name: string): Promise<ArtifactHubPackage | null> {
    return this.get(`/packages/helm/${encodeURIComponent(repository)}/${encodeURIComponent(name)}`);
  }

  securityReport(packageId: string, version: string): Promise<SecurityReport | null> {
    return this.get(`/packages/${encodeURIComponent(packageId)}/${encodeURIComponent(version)}/security-report`);
  }
}

/** Repositories named by a given Helm chart location, such as a tree URL in another repository. */
function repositoriesOfLocations(locations: string[]): RepositoryRef[] {
  return locations.flatMap((location) => {
    const target = repositoryOfUrl(location);
    return target?.repo ? [{ owner: target.owner, repo: target.repo }] : [];
  });
}

/** The chart name a Helm chart location ends in, such as charts/open-zaak. */
function chartNameOfLocation(location: string): string | null {
  const url = parseUrl(location);
  const parts = (url ? url.pathname : location).split("/").filter(Boolean);
  const last = parts[parts.length - 1]?.toLowerCase();
  if (!last) return null;
  return last === "chart.yaml" ? (parts[parts.length - 2]?.toLowerCase() ?? null) : last;
}

async function readFirst(context: RepoContext, tree: string[], predicate: (path: string) => boolean): Promise<{ path: string; content: string } | null> {
  const path = tree.find(predicate);
  if (!path) return null;
  const content = await context.provider.getFileContent(context, path);
  return content ? { path, content } : null;
}

/** Finds the component's Helm package on Artifact Hub, and explains how it was matched. */
async function findPackage(
  client: ArtifactHubClient,
  context: RepoContext,
  tree: string[],
  helmChartLocations: string[],
  baseUrl: string
): Promise<{ match: Match | null; searched: string[]; evidence: string[] }> {
  const evidence: string[] = [];

  const readmePath = tree.find((path) => README_FILES.includes(path.toLowerCase()));
  const publiccodePath = findPubliccodeFile(tree);
  for (const path of [readmePath, publiccodePath]) {
    if (!path) continue;
    const content = await context.provider.getFileContent(context, path);
    for (const link of findArtifactHubLinks(content ?? "", baseUrl)) {
      const pkg = await client.helmPackage(link.repository, link.name);
      if (pkg) {
        return { match: { pkg, strength: 4, how: `${path} links to it on Artifact Hub` }, searched: [], evidence };
      }
      evidence.push(`${path} links to ${link.repository}/${link.name}, which Artifact Hub does not know`);
    }
  }

  const repoFile = await readFirst(context, tree, (path) => {
    const name = filename(path);
    return name === "artifacthub-repo.yml" || name === "artifacthub-repo.yaml";
  });
  const repositoryId = repoFile ? parseArtifactHubRepositoryId(repoFile.content) : null;
  if (repoFile && repositoryId) evidence.push(`${repoFile.path}: repositoryID ${repositoryId}`);

  const chartNames: string[] = [];
  for (const path of tree.filter((candidate) => filename(candidate) === "chart.yaml").slice(0, MAX_SEARCH_TERMS)) {
    const content = await context.provider.getFileContent(context, path);
    const name = content ? parseChartName(content) : null;
    if (name) chartNames.push(name.toLowerCase());
  }
  const names = [
    ...new Set([
      ...chartNames,
      ...helmChartLocations.map(chartNameOfLocation).filter((name): name is string => !!name),
      context.repo.toLowerCase(),
    ]),
  ].slice(0, MAX_SEARCH_TERMS);
  const repositories: RepositoryRef[] = [
    { owner: context.owner.toLowerCase(), repo: context.repo.toLowerCase() },
    ...repositoriesOfLocations(helmChartLocations),
  ];

  const candidates = new Map<string, ArtifactHubPackageSummary>();
  for (const name of names) {
    const found = await client.search(name);
    for (const pkg of found?.packages ?? []) {
      const sameName = pkg.name.toLowerCase() === name;
      const sameRepository = repositoryId !== null && pkg.repository.repository_id === repositoryId;
      if ((sameName || sameRepository) && !candidates.has(pkg.package_id)) candidates.set(pkg.package_id, pkg);
    }
  }

  // Candidates whose chart repository already points at the repository or its owner are fetched first.
  const ownerRank = (summary: ArtifactHubPackageSummary): number => {
    const target = repositoryOfUrl(summary.repository.url);
    if (!target) return 0;
    if (repositories.some((ref) => ref.owner === target.owner && ref.repo === target.repo)) return 2;
    return repositories.some((ref) => ref.owner === target.owner) ? 1 : 0;
  };
  const ranked = [...candidates.values()].sort((a, b) => ownerRank(b) - ownerRank(a));

  let best: Match | null = null;
  for (const summary of ranked.slice(0, MAX_CANDIDATES)) {
    const pkg = await client.helmPackage(summary.repository.name, summary.name);
    if (!pkg) continue;
    const match = matchPackage(pkg, repositories, names, repositoryId);
    if (match && (!best || match.strength > best.strength)) best = { pkg, ...match };
  }
  return { match: best, searched: names, evidence };
}

/**
 * Whether the component's Helm chart is on Artifact Hub and the latest version's
 * images have no critical vulnerabilities in Artifact Hub's Trivy report.
 * Only for container components. A version Artifact Hub does not scan is not
 * measured, never passed.
 */
export async function checkArtifactHub(
  context: RepoContext,
  tree: string[],
  options: CheckArtifactHubOptions = {}
): Promise<CheckResult> {
  const helmChartLocations = (options.helmChartLocations ?? []).map((value) => value.trim()).filter(Boolean);
  const applicability = containerComponentReason(tree, options.dockerLocations, helmChartLocations);
  if (!applicability.applies) {
    return result("info", `Not applicable: ${applicability.reason}`);
  }

  const baseUrl = options.baseUrl ?? artifactHubBaseUrl();
  const now = options.now ?? new Date();
  const client = new ArtifactHubClient(baseUrl);
  const evidence = [`Container component: ${applicability.reason}`];

  try {
    const found = await findPackage(client, context, tree, helmChartLocations, baseUrl);
    evidence.push(...found.evidence);
    if (!found.match) {
      return result(
        "fail",
        `No Helm package on Artifact Hub belongs to this repository. Searched for ${found.searched.join(", ")}. Register the Helm chart on Artifact Hub, and link the package from the README if its name differs.`,
        evidence
      );
    }

    const { pkg, how } = found.match;
    const packageUrl = `${baseUrl}/packages/helm/${pkg.repository.name}/${pkg.name}`;
    const label = `${pkg.repository.name}/${pkg.name} ${pkg.version}`;
    evidence.push(`Artifact Hub package: ${packageUrl}`, `Matched because ${how}`);

    if (pkg.repository.private) {
      return notMeasured(`the Artifact Hub repository of ${label} is private, and Artifact Hub does not scan private repositories.`, evidence, packageUrl);
    }
    if (pkg.repository.scanner_disabled) {
      return notMeasured(`the security scanner is switched off for the Artifact Hub repository of ${label}. Its publisher can switch it on.`, evidence, packageUrl);
    }

    const lastScan = pkg.security_report_created_at
      ? `The last report is from ${formatDate(pkg.security_report_created_at)}: ${formatCounts(pkg.security_report_summary ?? {})}.`
      : "";
    if (typeof pkg.ts === "number" && now.getTime() - pkg.ts * 1000 > MAX_SCANNED_AGE_MS) {
      if (lastScan) evidence.push(`${lastScan} It is no longer updated.`);
      return notMeasured(
        `the latest version on Artifact Hub, ${label}, was released on ${formatDate(pkg.ts)}. Artifact Hub does not scan versions older than one year. Publish a new chart version.`,
        evidence,
        packageUrl
      );
    }

    const images = (pkg.containers_images ?? []).map((item) => item.image).filter((image): image is string => !!image);
    if (images.length === 0) {
      return notMeasured(
        `Artifact Hub found no container images in ${label}. List them in the artifacthub.io/images annotation of Chart.yaml.`,
        evidence,
        packageUrl
      );
    }
    if (images.length > MAX_SCANNED_IMAGES) {
      return notMeasured(
        `${label} uses ${images.length} images. Artifact Hub does not scan a version with more than ${MAX_SCANNED_IMAGES}.`,
        evidence,
        packageUrl
      );
    }
    if (pkg.all_containers_images_whitelisted) {
      return notMeasured(`the publisher of ${label} excluded all its images from the scan.`, evidence, packageUrl);
    }

    const report = await client.securityReport(pkg.package_id, pkg.version);
    if (!report || Object.keys(report).length === 0) {
      return notMeasured(
        `Artifact Hub has no security report for ${label} yet. A new version is scanned within the hour; check that its images are public.`,
        evidence,
        packageUrl
      );
    }

    const scans: ImageScan[] = images.filter((image) => report[image]).map((image) => ({ image, counts: countSeverities(report[image]) }));
    const unscanned = images.filter((image) => !report[image]);
    const scanDate = pkg.security_report_created_at ? formatDate(pkg.security_report_created_at) : "an unknown date";
    evidence.push(`Scanned with Trivy on ${scanDate}`);
    for (const scan of scans) evidence.push(`${scan.image}: ${formatCounts(scan.counts)}`);
    for (const image of unscanned) evidence.push(`${image}: not scanned (private, or larger than 4 GiB)`);

    if (scans.length === 0) {
      return notMeasured(`the security report of ${label} covers none of its images.`, evidence, packageUrl);
    }

    const critical = scans.filter((scan) => scan.counts.critical > 0);
    const total = scans.reduce<SeverityCounts>(
      (sum, scan) => Object.fromEntries(SEVERITIES.map((severity) => [severity, sum[severity] + scan.counts[severity]])) as SeverityCounts,
      { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
    );
    const imagesScanned =
      scans.length === images.length
        ? images.length === 1
          ? "the image"
          : `all ${images.length} images`
        : `${scans.length} of the ${images.length} images`;
    const scanned = `Artifact Hub scanned ${imagesScanned} of ${label} with Trivy on ${scanDate}`;

    if (critical.length > 0) {
      return result(
        "fail",
        `${scanned}: ${total.critical} critical vulnerabilities, in ${critical.map((scan) => `${scan.image} (${scan.counts.critical})`).join(", ")}. In total: ${formatCounts(total)}.`,
        evidence,
        packageUrl
      );
    }
    if (unscanned.length > 0) {
      return notMeasured(
        `${scanned}, with no critical vulnerabilities, but ${unscanned.join(", ")} ${unscanned.length === 1 ? "was" : "were"} not scanned.`,
        evidence,
        packageUrl
      );
    }
    return result("pass", `${scanned}: no critical vulnerabilities. In total: ${formatCounts(total)}.`, evidence, packageUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return notMeasured(`Artifact Hub could not be reached (${reason}).`, evidence);
  }
}
