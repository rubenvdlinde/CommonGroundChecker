/**
 * The Providers pages: organisations that offer services for a component,
 * from the `providers` field of config/repositories.yml. Both modes read the
 * file when the site is built; a provider adds itself by pull request.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PROVIDER_SERVICES,
  parseYaml,
  repositoryPath,
  type ProviderService,
  type RepositoriesConfig,
  type ServiceProvider,
} from "@/lib/staticSite/config";
import { componentHref } from "@/lib/routes";

export const SERVICE_LABELS: Record<ProviderService, string> = {
  maintenance: "Maintenance",
  support: "Support",
  hosting: "Hosting",
  implementation: "Implementation",
  training: "Training",
};

/** One component a provider serves, with the services it offers for that component. */
export interface ProvidedComponent {
  url: string;
  owner: string;
  repo: string;
  href: string;
  services: ProviderService[];
  /** YYYY-MM-DD */
  since: string | null;
}

export interface ProviderSummary {
  slug: string;
  name: string;
  url: string | null;
  contact: string | null;
  /** Every service it offers for any component, in the order of PROVIDER_SERVICES */
  services: ProviderService[];
  /** The earliest since of its entries */
  since: string | null;
  /** Sorted by owner and name */
  components: ProvidedComponent[];
}

/** The address of a provider's page: its name in lower case, without accents, words joined by hyphens. */
export function providerSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function orderedServices(services: Iterable<string>): ProviderService[] {
  const set = new Set(services);
  return PROVIDER_SERVICES.filter((service) => set.has(service));
}

function earliest(a: string | null, b: string | undefined): string | null {
  if (!b) return a;
  return a === null || b < a ? b : a;
}

/** Groups the providers of every listed component by provider, sorted by name. */
export function collectProviders(config: RepositoriesConfig): ProviderSummary[] {
  const bySlug = new Map<string, ProviderSummary>();
  for (const entry of config.repositories) {
    let location;
    try {
      location = repositoryPath(entry.url);
    } catch {
      continue;
    }
    for (const provider of entry.providers ?? []) {
      const slug = providerSlug(provider.name);
      if (!slug) continue;
      const summary = bySlug.get(slug) ?? {
        slug,
        name: provider.name.trim(),
        url: null,
        contact: null,
        services: [],
        since: null,
        components: [],
      };
      summary.url ??= provider.url ?? null;
      summary.contact ??= provider.contact ?? null;
      summary.since = earliest(summary.since, provider.since);
      summary.services = orderedServices([...summary.services, ...provider.services]);
      summary.components.push({
        url: entry.url,
        owner: location.owner,
        repo: location.repo,
        href: componentHref(location.owner, location.repo),
        services: orderedServices(provider.services),
        since: provider.since ?? null,
      });
      bySlug.set(slug, summary);
    }
  }
  const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
  return [...bySlug.values()]
    .map((summary) => ({
      ...summary,
      components: summary.components.sort((a, b) => byName(`${a.owner}/${a.repo}`, `${b.owner}/${b.repo}`)),
    }))
    .sort((a, b) => byName(a.name, b.name));
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

/** The repositories and their providers from the parsed YAML; entries that are not a repository are left out. */
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

/** config/repositories.yml, or the file CGC_REPOSITORIES_FILE names. */
export function repositoriesFile(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.CGC_REPOSITORIES_FILE || "config/repositories.yml");
}

/** Every provider of the component list; none when the file does not exist. */
export async function loadProviders(file: string = repositoriesFile()): Promise<ProviderSummary[]> {
  let text: string;
  try {
    text = await readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return collectProviders(readRepositoriesConfig(parseYaml(text)));
}

/** A link for a provider's contact: a web address as is, an e-mail address as mailto; null for anything else. */
export function contactHref(contact: string): string | null {
  if (/^https?:\/\//.test(contact)) return contact;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`;
  return null;
}
