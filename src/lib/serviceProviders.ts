/**
 * The Providers pages. A provider is the owner of a component's repository:
 * the GitHub organisation or user, or the GitLab group, that hosts it. The
 * pages derive the providers from the component list, so they need no input.
 * The optional `providers` field of config/repositories.yml names services
 * an organisation offers for a component; those show as "Also offers".
 */
import { readFile } from "node:fs/promises";
import type { RepoSummary } from "@/generated/openapi-client";
import { isInBasisset, loadBasisset, type Basisset } from "@/lib/basisset";
import { dataSource } from "@/lib/dataSource";
import { toHistoryIndexEntry } from "@/lib/historyIndex";
import type { LifecycleStatus } from "@/lib/lifecycle";
import { repositoriesFile } from "@/lib/maintainedDecisions";
import { ownerOfRepository, type RepositoryOwner } from "@/lib/repositoryOwner";
import { componentHref } from "@/lib/routes";
import {
  PROVIDER_SERVICES,
  normalizeRepositoryUrl,
  parseYaml,
  repositoryPath,
  type ProviderService,
  type RepositoriesConfig,
  type ServiceProvider,
} from "@/lib/staticSite/config";

export { SERVICE_LABELS } from "@/lib/staticSite/config";
export { ownerOfRepository, ownerSlug, type RepositoryOwner } from "@/lib/repositoryOwner";

/** Services an organisation listed for a component in the component list. */
export interface ListedServices {
  name: string;
  url: string | null;
  services: ProviderService[];
}

/** One component of a provider, with what the checker knows about it. */
export interface OwnedComponent {
  owner: string;
  repo: string;
  name: string;
  repoUrl: string;
  href: string;
  /** False for a component on the list that has no successful scan yet, so no page */
  analysed: boolean;
  rating: number | null;
  status: LifecycleStatus | null;
  /** Null when the basisset does not list it; false when it is listed next to the basisset */
  basisset: boolean | null;
  /** Services the owner itself listed for this component */
  services: ProviderService[];
}

export interface ProviderSummary extends RepositoryOwner {
  avatarUrl: string | null;
  /** Sorted by name */
  components: OwnedComponent[];
  bestRating: number | null;
  /** Every service the owner listed for any of its components, in the order of PROVIDER_SERVICES */
  services: ProviderService[];
}

/** What collectProviders needs of one component. */
export interface ComponentInput {
  repoUrl: string;
  /** Owner and name as the data names them, for the component's address; else as the URL does */
  owner?: string;
  repo?: string;
  displayName?: string | null;
  analysed: boolean;
  rating?: number | null;
  status?: LifecycleStatus | null;
  basisset?: boolean | null;
}

/** The avatar GitHub serves for every user and organisation; null on other hosts. */
export function githubAvatarUrl(owner: RepositoryOwner): string | null {
  return owner.host === "github.com" ? `https://github.com/${owner.name}.png?size=96` : null;
}

/** The avatar of a public GitLab group, read without a token; null when it has none or cannot be read. */
export async function gitlabAvatarUrl(owner: RepositoryOwner, fetchFn: typeof fetch = fetch): Promise<string | null> {
  if (owner.hostLabel !== "GitLab") return null;
  try {
    const response = await fetchFn(`https://${owner.host}/api/v4/groups/${encodeURIComponent(owner.name)}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const avatar = ((await response.json()) as { avatar_url?: unknown }).avatar_url;
    return typeof avatar === "string" && /^https:\/\//.test(avatar) ? avatar : null;
  } catch {
    return null;
  }
}

function orderedServices(services: Iterable<string>): ProviderService[] {
  const set = new Set(services);
  return PROVIDER_SERVICES.filter((service) => set.has(service));
}

function squash(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Whether a listed provider is the owner itself: the same name, ignoring case and spacing, or the owner's page. */
export function isOwner(provider: { name: string; url?: string | null }, owner: RepositoryOwner): boolean {
  const name = squash(provider.name);
  const ownerNames = [owner.name, owner.name.split("/").pop() ?? ""].map(squash);
  if (name && ownerNames.includes(name)) return true;
  if (!provider.url) return false;
  try {
    return normalizeRepositoryUrl(provider.url).toLowerCase() === owner.url.toLowerCase();
  } catch {
    return false;
  }
}

function repositoryKey(url: string): string | null {
  try {
    return normalizeRepositoryUrl(url).toLowerCase();
  } catch {
    return null;
  }
}

/** The services listed in the component list, by lower-case normalised repository URL. */
export function listedServicesByRepository(config: RepositoriesConfig): Map<string, ListedServices[]> {
  const result = new Map<string, ListedServices[]>();
  for (const entry of config.repositories) {
    const key = repositoryKey(entry.url);
    if (!key || !entry.providers?.length) continue;
    result.set(
      key,
      entry.providers.map((provider) => ({
        name: provider.name.trim(),
        url: provider.url ?? null,
        services: orderedServices(provider.services),
      }))
    );
  }
  return result;
}

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/**
 * One provider per repository owner, from the components the data names and
 * the ones on the component list it does not name yet. Most components first,
 * then by name.
 */
export function collectProviders(components: ComponentInput[], config: RepositoriesConfig): ProviderSummary[] {
  const listed = listedServicesByRepository(config);
  const seen = new Set<string>();
  const inputs = [
    ...components,
    ...config.repositories.map((entry): ComponentInput => ({ repoUrl: entry.url, analysed: false })),
  ];
  const bySlug = new Map<string, ProviderSummary>();
  for (const input of inputs) {
    const key = repositoryKey(input.repoUrl);
    const owner = ownerOfRepository(input.repoUrl);
    if (!key || !owner || !owner.slug || seen.has(key)) continue;
    seen.add(key);
    const location = repositoryPath(input.repoUrl);
    const ownerName = input.owner ?? location.owner;
    const repo = input.repo ?? location.repo;
    const services = orderedServices(
      (listed.get(key) ?? []).filter((provider) => isOwner(provider, owner)).flatMap((provider) => provider.services)
    );
    const summary = bySlug.get(owner.slug) ?? {
      ...owner,
      avatarUrl: githubAvatarUrl(owner),
      components: [],
      bestRating: null,
      services: [],
    };
    const rating = typeof input.rating === "number" ? input.rating : null;
    summary.components.push({
      owner: ownerName,
      repo,
      name: input.displayName?.trim() || `${ownerName}/${repo}`,
      repoUrl: input.repoUrl,
      href: componentHref(ownerName, repo),
      analysed: input.analysed,
      rating,
      status: input.status ?? null,
      basisset: input.basisset ?? null,
      services,
    });
    if (rating !== null && (summary.bestRating === null || rating > summary.bestRating)) summary.bestRating = rating;
    summary.services = orderedServices([...summary.services, ...services]);
    bySlug.set(owner.slug, summary);
  }
  return [...bySlug.values()]
    .map((summary) => ({ ...summary, components: summary.components.sort((a, b) => byName(a.name, b.name)) }))
    .sort((a, b) => b.components.length - a.components.length || byName(a.name, b.name));
}

/** What a provider page needs of one repository the data source lists. */
export function componentInputOf(repository: RepoSummary, basisset: Basisset | null, today: string): ComponentInput {
  const entry = toHistoryIndexEntry(repository, { basisset, today });
  return {
    repoUrl: repository.repoUrl,
    owner: repository.owner,
    repo: repository.name,
    displayName: repository.displayName,
    analysed: Boolean(repository.latestAnalysis),
    rating: entry.rating,
    status: entry.lifecycle.status,
    basisset: entry.basisset.entries.length > 0 ? isInBasisset(entry.basisset) : null,
  };
}

function asProvider(value: unknown): ServiceProvider | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  const text = (field: unknown) => (typeof field === "string" && field.trim() ? field.trim() : undefined);
  return {
    name: raw.name,
    services: Array.isArray(raw.services) ? orderedServices(raw.services.filter((item) => typeof item === "string")) : [],
    url: text(raw.url),
    contact: text(raw.contact),
    since: text(raw.since),
  };
}

/** The repositories and their listed services from the parsed YAML; entries that are not a repository are left out. */
export function readRepositoriesConfig(raw: unknown): RepositoriesConfig {
  const list = raw && typeof raw === "object" ? (raw as { repositories?: unknown }).repositories : undefined;
  if (!Array.isArray(list)) return { repositories: [] };
  return {
    repositories: list.flatMap((item) => {
      if (!item || typeof item !== "object" || typeof (item as { url?: unknown }).url !== "string") return [];
      const providers = (item as { providers?: unknown }).providers;
      return [
        {
          url: (item as { url: string }).url,
          providers: Array.isArray(providers)
            ? providers.map(asProvider).filter((provider): provider is ServiceProvider => provider !== null)
            : [],
        },
      ];
    }),
  };
}

export { repositoriesFile } from "@/lib/maintainedDecisions";

/** The component list; empty when the file does not exist. */
export async function loadRepositoriesConfig(file: string = repositoriesFile()): Promise<RepositoriesConfig> {
  try {
    return readRepositoriesConfig(parseYaml(await readFile(file, "utf-8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { repositories: [] };
    throw err;
  }
}

/** Every provider, read when the page is built or rendered; GitLab avatars are fetched once per load. */
export async function loadProviders(): Promise<ProviderSummary[]> {
  const [config, repositories, basisset] = await Promise.all([
    loadRepositoriesConfig(),
    dataSource()
      .listRepositories({ limit: 500 })
      .catch(() => [] as RepoSummary[]),
    loadBasisset(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const providers = collectProviders(
    repositories.map((repository) => componentInputOf(repository, basisset, today)),
    config
  );
  await Promise.all(
    providers
      .filter((provider) => provider.avatarUrl === null)
      .map(async (provider) => {
        provider.avatarUrl = await gitlabAvatarUrl(provider);
      })
  );
  return providers;
}

/** A link for a provider's contact: a web address as is, an e-mail address as mailto; null for anything else. */
export function contactHref(contact: string): string | null {
  if (/^https?:\/\//.test(contact)) return contact;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`;
  return null;
}

/** The services listed for each component, by owner/repo, for the compare page. */
export function listedServicesByComponent(config: RepositoriesConfig): Record<string, ListedServices[]> {
  const result: Record<string, ListedServices[]> = {};
  for (const entry of config.repositories) {
    if (!entry.providers?.length) continue;
    let location;
    try {
      location = repositoryPath(entry.url);
    } catch {
      continue;
    }
    result[`${location.owner}/${location.repo}`] = listedServicesByRepository({ repositories: [entry] }).get(
      repositoryKey(entry.url) ?? ""
    ) ?? [];
  }
  return result;
}
