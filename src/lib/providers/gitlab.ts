import type {
  ParsedRepoTreeUrl,
  RepoContext,
  RepoIdentifier,
  RepositoryProvider,
  RepoVersionResult,
} from "./types";
import { encodePathSegments } from "./paths";

const BASE = "https://gitlab.com/api/v4";
const MANIFEST_CANDIDATES = ["package.json", "pyproject.toml", "Chart.yaml"];

function headers() {
  const h: Record<string, string> = {
    Accept: "application/json",
  };
  if (process.env.GITLAB_TOKEN) {
    h["Authorization"] = `Bearer ${process.env.GITLAB_TOKEN}`;
  }
  return h;
}

async function glFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitLab API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeProjectPath(raw: string): string {
  return raw.replace(/\.git$/, "").replace(/\/+$/, "");
}

function encodeProjectPath(projectPath: string): string {
  return encodeURIComponent(projectPath);
}

async function getGitLabFileContent(
  projectPath: string,
  path: string,
  branch: string
): Promise<string | null> {
  try {
    const encodedProject = encodeProjectPath(projectPath);
    const encodedPath = encodeURIComponent(path);
    const data = await glFetch(
      `/projects/${encodedProject}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`
    );
    if (data?.encoding === "base64" && typeof data?.content === "string") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

function parseGitLabRepoUrl(url: string): RepoIdentifier | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "gitlab.com") return null;
    const rawPath = u.pathname.replace(/^\//, "").replace(/\/+$/, "");
    if (!rawPath) return null;
    const pathParts = rawPath.split("/");
    const dashIndex = pathParts.indexOf("-");
    const projectParts = dashIndex >= 0 ? pathParts.slice(0, dashIndex) : pathParts;
    if (projectParts.length < 2) return null;
    const projectPath = normalizeProjectPath(projectParts.join("/"));
    const owner = projectParts[0];
    const repo = projectParts[projectParts.length - 1].replace(/\.git$/, "");
    if (!owner || !repo) return null;
    return { owner, repo, projectPath };
  } catch {
    return null;
  }
}

export const GitLabRepositoryProvider: RepositoryProvider = {
  id: "gitlab",
  hostname: "gitlab.com",
  parseRepoUrl(url: string): RepoIdentifier | null {
    return parseGitLabRepoUrl(url);
  },
  getRepoMeta: async (context: RepoContext) => {
    const encodedProject = encodeProjectPath(context.projectPath);
    return glFetch(`/projects/${encodedProject}`);
  },
  getRepoTree: async (context: RepoContext, branch: string) => {
    const project = encodeProjectPath(context.projectPath);
    const paths: string[] = [];
    let page = 1;

    while (true) {
      const data = await glFetch(
        `/projects/${project}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100&page=${page}`
      );
      if (!Array.isArray(data) || data.length === 0) break;
      for (const item of data) {
        if (typeof item?.path === "string") {
          paths.push(item.path);
        }
      }
      if (data.length < 100) break;
      page += 1;
    }

    return paths;
  },
  getFileContent: async (context: RepoContext, path: string) => {
    const branch = context.defaultBranch ?? "main";
    return getGitLabFileContent(context.projectPath, path, branch);
  },
  getRepoVersion: async (context: RepoContext) => {
    const encodedProject = encodeProjectPath(context.projectPath);
    const branch = context.defaultBranch ?? "main";

    try {
      const releases = await glFetch(
        `/projects/${encodedProject}/releases?per_page=20`
      );
      if (Array.isArray(releases) && releases.length > 0) {
        const stableReleases = releases
          .filter((entry) => entry?.tag_name && !entry?.tag_name.toString().toLowerCase().includes("rc"));
        const candidate = stableReleases.length > 0 ? stableReleases[0] : releases[0];
        const tagName = typeof candidate?.tag_name === "string" ? candidate.tag_name.trim() : "";
        if (tagName) {
          return {
            version: tagName.startsWith("v") ? tagName : `v${tagName}`,
            evidence: {
              source: "release",
              detail: `latest GitLab release: ${tagName}`,
            },
          };
        }
      }
    } catch {
      // ignore
    }

    try {
      const tags = await glFetch(
        `/projects/${encodedProject}/repository/tags?per_page=50`
      );
      if (Array.isArray(tags) && tags.length > 0) {
        const tagNames = tags
          .map((entry) => (typeof entry?.name === "string" ? entry.name : ""))
          .filter(Boolean);
        const bestTag = tagNames[0];
        if (bestTag) {
          return {
            version: bestTag.startsWith("v") ? bestTag : `v${bestTag}`,
            evidence: {
              source: "tag",
              detail: `latest GitLab tag: ${bestTag}`,
            },
          };
        }
      }
    } catch {
      // ignore
    }

    for (const filePath of MANIFEST_CANDIDATES) {
      const content = await getGitLabFileContent(context.projectPath, filePath, branch);
      if (!content) continue;
      if (filePath === "package.json") {
        try {
          const parsed = JSON.parse(content) as { version?: unknown };
          if (typeof parsed.version === "string" && parsed.version.trim()) {
            const version = parsed.version.trim();
            return {
              version: version.startsWith("v") ? version : `v${version}`,
              evidence: {
                source: "manifest",
                detail: `root manifest ${filePath}`,
              },
            };
          }
        } catch {
          // ignore
        }
      }
      if (filePath === "pyproject.toml") {
        const match = content.match(/^version\s*=\s*["']([^"']+)["']/m);
        if (match?.[1]) {
          const version = match[1].trim();
          return {
            version: version.startsWith("v") ? version : `v${version}`,
            evidence: {
              source: "manifest",
              detail: `root manifest ${filePath}`,
            },
          };
        }
      }
      if (filePath === "Chart.yaml") {
        const match = content.match(/^version\s*:\s*([\w.+-]+)/m);
        if (match?.[1]) {
          const version = match[1].trim();
          return {
            version: version.startsWith("v") ? version : `v${version}`,
            evidence: {
              source: "manifest",
              detail: `root manifest ${filePath}`,
            },
          };
        }
      }
    }

    return {
      version: null,
      evidence: {
        source: "none",
        detail: "No release, tag, or manifest version found",
      },
    };
  },
  getCloneUrl: (context: RepoContext) =>
    `https://gitlab.com/${context.projectPath}.git`,
  getRawFileUrl: (context: RepoContext, branch: string, path: string) =>
    `https://gitlab.com/${context.projectPath}/-/raw/${encodePathSegments(branch)}/${encodePathSegments(path)}`,
  parseRepoTreeUrl: (url: string): ParsedRepoTreeUrl | null => {
    try {
      const u = new URL(url.trim());
      if (u.hostname !== "gitlab.com") return null;
      const rawPath = u.pathname.replace(/^\//, "").replace(/\/+$/, "");
      const parts = rawPath.split("/");
      const dashIndex = parts.indexOf("-");
      if (dashIndex < 0 || dashIndex + 2 >= parts.length) return null;
      const projectPath = normalizeProjectPath(parts.slice(0, dashIndex).join("/"));
      const mode = parts[dashIndex + 1];
      const branch = parts[dashIndex + 2];
      const pathSegments = parts.slice(dashIndex + 3);
      const filePath = pathSegments.join("/");
      if (!projectPath || !branch || !filePath) return null;
      const pathParts = projectPath.split("/");
      return {
        owner: pathParts[0],
        repo: pathParts[pathParts.length - 1],
        branch,
        path: filePath,
        projectPath,
      };
    } catch {
      return null;
    }
  },
};
