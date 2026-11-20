type FetchFn = typeof fetch;

export type ImageRegistry = "dockerhub" | "ghcr";

export interface ImageCandidate {
  registry: ImageRegistry;
  /** namespace/name, lowercase. */
  image: string;
  /** Path of the text the image was named in. */
  foundIn: string;
}

export interface ConfirmOptions {
  fetchFn?: FetchFn;
  /** Most candidates looked up on a registry. */
  limit?: number;
  timeoutMs?: number;
}

const REGISTRY_NAMES: Record<ImageRegistry, string> = {
  dockerhub: "Docker Hub",
  ghcr: "GitHub Container Registry",
};

export function looseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const DOCKER_HUB_PATTERNS = [
  /hub\.docker\.com\/r\/([\w.-]+)\/([\w.-]+)/gi,
  /hub\.docker\.com\/repository\/docker\/([\w.-]+)\/([\w.-]+)/gi,
  /\bdocker\.io\/([\w.-]+)\/([\w.-]+)/gi,
  // A bare namespace/name (no registry host) after `docker pull` or `image:` is a Docker Hub image.
  /\bdocker\s+pull\s+(?:-\S+\s+)*([\w-]+)\/([\w.-]+)(?![\w.-]*\/)/gi,
  /^[ \t]*-?[ \t]*image[ \t]*:[ \t]*["']?([\w-]+)\/([\w.-]+)(?![\w.-]*\/)/gim,
];
const GHCR_PATTERN = /\bghcr\.io\/([\w.-]+)\/([\w.-]+)/gi;

/**
 * Images named in the repository's texts (README, docs) whose namespace or name
 * is the repository's owner or name, so that images it merely uses are left out.
 */
export function findImageCandidates(
  texts: Array<{ path: string; content: string }>,
  owner: string,
  repo: string
): ImageCandidate[] {
  const ours = (namespace: string, name: string) =>
    looseName(namespace) === looseName(owner) || looseName(name) === looseName(repo);
  const found = new Map<string, ImageCandidate>();
  const add = (registry: ImageRegistry, namespace: string, rawName: string, foundIn: string) => {
    const name = rawName.replace(/\.+$/, "");
    if (!name || !ours(namespace, name)) return;
    if (registry === "dockerhub" && namespace.toLowerCase() === "library") return;
    const image = `${namespace}/${name}`.toLowerCase();
    const key = `${registry}:${image}`;
    if (!found.has(key)) found.set(key, { registry, image, foundIn });
  };

  for (const text of texts) {
    for (const pattern of DOCKER_HUB_PATTERNS) {
      for (const [, namespace, name] of text.content.matchAll(pattern)) add("dockerhub", namespace, name, text.path);
    }
    for (const [, namespace, name] of text.content.matchAll(GHCR_PATTERN)) add("ghcr", namespace, name, text.path);
  }
  return Array.from(found.values());
}

async function isOk(fetchFn: FetchFn, url: string, timeoutMs: number, headers?: Record<string, string>) {
  const response = await fetchFn(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  return response.ok;
}

/** Whether the registry has the image. A network failure or any non-2xx answer means not confirmed. */
export async function imageExists(candidate: ImageCandidate, options: ConfirmOptions = {}): Promise<boolean> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  try {
    if (candidate.registry === "dockerhub") {
      return await isOk(fetchFn, `https://hub.docker.com/v2/repositories/${candidate.image}/`, timeoutMs);
    }
    const tokenResponse = await fetchFn(`https://ghcr.io/token?scope=repository:${candidate.image}:pull`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!tokenResponse.ok) return false;
    const body: unknown = await tokenResponse.json();
    const token = typeof body === "object" && body !== null ? (body as { token?: unknown }).token : undefined;
    if (typeof token !== "string" || !token) return false;
    return await isOk(fetchFn, `https://ghcr.io/v2/${candidate.image}/tags/list`, timeoutMs, {
      Authorization: `Bearer ${token}`,
    });
  } catch {
    return false;
  }
}

/** Evidence lines for the candidates the registry confirmed, at most `limit` candidates looked up. */
export async function confirmImageCandidates(
  candidates: ImageCandidate[],
  options: ConfirmOptions = {}
): Promise<string[]> {
  const checked = candidates.slice(0, options.limit ?? 5);
  const exists = await Promise.all(checked.map((candidate) => imageExists(candidate, options)));
  return checked
    .filter((_, index) => exists[index])
    .map(
      (candidate) =>
        `${candidate.image} on ${REGISTRY_NAMES[candidate.registry]} (named in ${candidate.foundIn}, found on the registry)`
    );
}

/** Root README files first, then Markdown or reStructuredText under docs/, at most `limit` paths. */
export function imageTextFiles(tree: string[], limit = 20): string[] {
  const readmes = tree.filter((path) => /^readme(\.[\w]+)?$/i.test(path));
  const docs = tree.filter((path) => /^docs\/.+\.(md|rst)$/i.test(path));
  return [...readmes, ...docs].slice(0, limit);
}
