import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { detectLicenseFromText } from "../checkers/license";
import {
  MANIFEST_CANDIDATES,
  README_CANDIDATES,
  extractVersionFromChartYaml,
  extractVersionFromPackageJson,
  extractVersionFromPyproject,
  extractVersionFromReadme,
  pickBestTagName,
} from "../github";
import { encodePathSegments } from "./paths";
import type {
  RepoContext,
  RepoIdentifier,
  RepositoryMeta,
  RepositoryProvider,
  RepoVersionResult,
} from "./types";

const execFileAsync = promisify(execFile);

const LICENSE_FILES = ["license", "license.md", "license.txt", "copying"];

/** A local checkout scanned in place, with the hosting repository it was cloned from when known. */
export interface LocalCheckout {
  dir: string;
  owner: string;
  repo: string;
  /** "github" or "gitlab" when the origin remote names one, used for raw file links only */
  host: string | null;
}

async function git(dir: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-c", "safe.directory=*", ...args], {
      cwd: dir,
      maxBuffer: 256 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

/** Owner, repository and host parsed from a git remote URL (https or ssh). */
export function parseRemoteUrl(remote: string): { owner: string; repo: string; host: string | null } | null {
  const match = remote
    .trim()
    .match(/^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/(?:[^@/]+@)?|[^@/]+@)([^/:]+)[/:](.+?)(?:\.git)?\/?$/i);
  if (!match) return null;
  const hostname = match[1].toLowerCase();
  const parts = match[2].split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const host = hostname.includes("github") ? "github" : hostname.includes("gitlab") ? "gitlab" : null;
  return { owner: parts.slice(0, -1).join("/"), repo: parts[parts.length - 1], host };
}

/**
 * Resolves the checkout's identity: `owner`/`repo` when given, else the origin remote,
 * else the directory name with owner "local".
 */
export async function resolveLocalCheckout(
  dir: string,
  owner?: string,
  repo?: string
): Promise<LocalCheckout> {
  const absolute = path.resolve(dir);
  const remote = (await git(absolute, ["remote", "get-url", "origin"]))?.trim() ?? "";
  const parsed = remote ? parseRemoteUrl(remote) : null;
  return {
    dir: absolute,
    owner: owner ?? parsed?.owner ?? "local",
    repo: repo ?? parsed?.repo ?? path.basename(absolute),
    host: parsed?.host ?? null,
  };
}

/** Every file git would commit (tracked plus untracked, ignores honoured) and every directory above one. */
export async function listCheckoutTree(dir: string): Promise<string[]> {
  const out = await git(dir, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  if (out === null) {
    throw new Error(`${dir} is not a git checkout`);
  }
  const entries = new Set<string>();
  for (const file of out.split("\0")) {
    if (!file || !existsSync(path.join(dir, file))) continue;
    entries.add(file);
    const segments = file.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      entries.add(segments.slice(0, i).join("/"));
    }
  }
  return [...entries].sort();
}

/** Resolves a repository path inside the checkout, refusing paths that leave it. */
export function resolveInside(dir: string, relativePath: string): string | null {
  const target = path.resolve(dir, relativePath);
  const root = path.resolve(dir);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

async function readCheckoutFile(dir: string, relativePath: string): Promise<string | null> {
  const target = resolveInside(dir, relativePath);
  if (!target) return null;
  try {
    if (!statSync(target).isFile()) return null;
    return await readFile(target, "utf-8");
  } catch {
    return null;
  }
}

async function localMeta(checkout: LocalCheckout): Promise<RepositoryMeta> {
  const branch = (await git(checkout.dir, ["rev-parse", "--abbrev-ref", "HEAD"]))?.trim();
  const tree = await listCheckoutTree(checkout.dir);
  const licenseFile = tree.find((p) => LICENSE_FILES.includes(p.toLowerCase()));
  const licenseText = licenseFile ? await readCheckoutFile(checkout.dir, licenseFile) : null;
  const licenseName = licenseText ? detectLicenseFromText(licenseText) : null;
  return {
    description: null,
    language: null,
    default_branch: branch && branch !== "HEAD" ? branch : "HEAD",
    topics: [],
    license: licenseName ? { spdx_id: null, name: licenseName } : null,
    owner: { login: checkout.owner },
  };
}

function versionFromManifest(file: string, content: string): string | null {
  if (file.endsWith("package.json")) return extractVersionFromPackageJson(content);
  if (file.endsWith("pyproject.toml")) return extractVersionFromPyproject(content);
  if (file.endsWith("Chart.yaml")) return extractVersionFromChartYaml(content);
  return null;
}

/** The version: the best tag reachable from HEAD, then a root manifest, then the README. */
async function localVersion(dir: string): Promise<RepoVersionResult> {
  const merged = await git(dir, ["tag", "--merged", "HEAD"]);
  const bestTag = merged ? pickBestTagName(merged.split(/\r?\n/)) : null;
  if (bestTag) {
    return { version: bestTag, evidence: { source: "tag", detail: `best git tag reachable from HEAD: ${bestTag}` } };
  }

  for (const file of MANIFEST_CANDIDATES) {
    const content = await readCheckoutFile(dir, file);
    const version = content ? versionFromManifest(file, content) : null;
    if (version) {
      return { version, evidence: { source: "manifest", detail: `root manifest ${file}` } };
    }
  }

  for (const file of README_CANDIDATES) {
    const content = await readCheckoutFile(dir, file);
    const version = content ? extractVersionFromReadme(content) : null;
    if (version) {
      return { version, evidence: { source: "readme", detail: `README pattern in ${file}` } };
    }
  }

  return {
    version: null,
    evidence: { source: "none", detail: "No reachable tag, manifest, or README version pattern found" },
  };
}

/** A provider that reads a local checkout instead of a hosting API. */
export function createLocalProvider(checkout: LocalCheckout): RepositoryProvider {
  return {
    id: "local",
    hostname: "localhost",
    parseRepoUrl: (): RepoIdentifier | null => null,
    getRepoMeta: async () => localMeta(checkout),
    getRepoTree: async () => listCheckoutTree(checkout.dir),
    getFileContent: async (_context: RepoContext, filePath: string) => readCheckoutFile(checkout.dir, filePath),
    getRepoVersion: async () => localVersion(checkout.dir),
    getCloneUrl: () => checkout.dir,
    getRawFileUrl: (_context: RepoContext, branch: string, filePath: string) =>
      checkout.host === "github"
        ? `https://raw.githubusercontent.com/${checkout.owner}/${checkout.repo}/${encodePathSegments(branch)}/${encodePathSegments(filePath)}`
        : `file://${path.join(checkout.dir, filePath)}`,
  };
}

/** The repository context of a local checkout; `projectPath` is the checkout directory. */
export function createLocalContext(checkout: LocalCheckout): RepoContext {
  return {
    owner: checkout.owner,
    repo: checkout.repo,
    projectPath: checkout.dir,
    repoUrl: checkout.host === "github"
      ? `https://github.com/${checkout.owner}/${checkout.repo}`
      : `file://${checkout.dir}`,
    provider: createLocalProvider(checkout),
  };
}
