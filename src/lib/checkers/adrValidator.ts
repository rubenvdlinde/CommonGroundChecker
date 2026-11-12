import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types";

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface SpectralResultItem {
  code?: string;
  message?: string;
  path?: Array<string | number>;
  severity?: number;
  source?: string;
}

const ADR_RULESET_URL = "https://static.developer.overheid.nl/adr/ruleset.yaml";

function resolveRulesetSource(source: string | undefined): string {
  const trimmed = source?.trim();
  if (!trimmed) return ADR_RULESET_URL;
  return trimmed;
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({
        code: 127,
        stdout,
        stderr: `${stderr}\n${error.message}`,
      });
    });

    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * The pinned Spectral binary from node_modules, or npx as a fallback. Concurrent
 * `npx --yes` runs share one cache and can delete each other's install.
 */
export function spectralCommand(
  args: string[],
  platform: NodeJS.Platform = process.platform,
  binaryExists: (binaryPath: string) => boolean = existsSync
): { command: string; args: string[] } {
  const binary = path.join(process.cwd(), "node_modules", ".bin", platform === "win32" ? "spectral.cmd" : "spectral");
  if (binaryExists(binary)) {
    return platform === "win32"
      ? { command: "cmd", args: ["/c", binary, ...args] }
      : { command: binary, args };
  }

  const npxArgs = ["--yes", "@stoplight/spectral-cli", ...args];
  return platform === "win32"
    ? { command: "cmd", args: ["/c", "npx", ...npxArgs] }
    : { command: "npx", args: npxArgs };
}

function runSpectralCommand(args: string[]): Promise<CommandResult> {
  const { command, args: commandArgs } = spectralCommand(args);
  return runCommand(command, commandArgs);
}

function parseSpectralJson(output: string): SpectralResultItem[] | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as SpectralResultItem[];
  } catch {
    // Try to recover a JSON array embedded in extra text (e.g. "[] No results..." or stderr lines).
    const match = output.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown;
        if (Array.isArray(parsed)) return parsed as SpectralResultItem[];
      } catch {
        // fall through to null
      }
    }
    return null;
  }
}

// Spectral severities follow DiagnosticSeverity from @stoplight/types:
// 0 = error, 1 = warning, 2 = information, 3 = hint.
function formatSeverityLabel(severity?: number): string {
  switch (severity) {
    case 0:
      return "ERROR";
    case 1:
      return "WARNING";
    case 3:
      return "HINT";
    default:
      return "INFO";
  }
}

interface SeverityCounts {
  errors: number;
  warnings: number;
  info: number;
  hints: number;
}

// Counts findings by Spectral severity (0 = error, 1 = warning, 2 = info, 3 = hint).
// A finding without a recognised severity counts as an error.
function addSeverityCounts(counts: SeverityCounts, issues: SpectralResultItem[]): void {
  for (const issue of issues) {
    switch (issue.severity) {
      case 1:
        counts.warnings += 1;
        break;
      case 2:
        counts.info += 1;
        break;
      case 3:
        counts.hints += 1;
        break;
      default:
        counts.errors += 1;
    }
  }
}

function formatSeverityCounts(counts: SeverityCounts): string {
  return `${counts.errors} error(s), ${counts.warnings} warning(s), ${counts.info} info, ${counts.hints} hint(s)`;
}

export function formatSpectralIssue(issue: SpectralResultItem): string {
  const severity = formatSeverityLabel(issue.severity);
  const code = issue.code ? `[${issue.code}] ` : "";
  const path = Array.isArray(issue.path) && issue.path.length > 0
    ? ` @ ${issue.path.join(".")}`
    : "";
  const source = issue.source ? ` (${issue.source})` : "";
  const message = issue.message?.trim() || "Rule violation";

  return `${severity} ${code}${message}${path}${source}`;
}

function buildRawGitHubUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;
}

function buildRawGitLabUrl(
  projectPath: string,
  branch: string,
  filePath: string
): string {
  const encodedProjectPath = projectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://gitlab.com/${encodedProjectPath}/-/raw/${encodeURIComponent(branch)}/${encodedPath}`;
}

// Convert https://github.com/owner/repo/blob/branch/path/to/file -> raw URL
function convertGitHubWebUrlToRaw(url: string): string | null {
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*?)$/i
  );
  if (match) {
    const [, owner, repo, branch, filePath] = match;
    return buildRawGitHubUrl(owner, repo, branch, filePath);
  }
  return null;
}

// Convert https://gitlab.com/group/project/-/blob/branch/path/to/file -> raw URL
function convertGitLabWebUrlToRaw(url: string): string | null {
  const match = url.match(
    /^https:\/\/gitlab\.com\/(.+?)\/-\/blob\/([^/]+)\/(.*?)$/i
  );
  if (match) {
    const [, projectPath, branch, filePath] = match;
    return buildRawGitLabUrl(projectPath, branch, filePath);
  }
  return null;
}

function convertRepositoryWebUrlToRaw(url: string): string | null {
  return convertGitHubWebUrlToRaw(url) ?? convertGitLabWebUrlToRaw(url);
}

function buildRawRepoUrl(
  providerId: string,
  projectPath: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): string {
  if (providerId === "gitlab") {
    return buildRawGitLabUrl(projectPath, branch, filePath);
  }
  return buildRawGitHubUrl(owner, repo, branch, filePath);
}

async function isReachableSpecUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/yaml, application/json, text/plain, */*" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

interface ResolvedTarget {
  url: string;
  source: string;
}

async function resolveSpecTargetUrls(
  providerId: string,
  projectPath: string,
  owner: string,
  repo: string,
  branch: string,
  tree: string[],
  apiSpecificationLocations: string[]
): Promise<ResolvedTarget[]> {
  const lowerTree = tree.map((path) => path.toLowerCase());
  const providedLocations = apiSpecificationLocations
    .map((location) => location.trim())
    .filter(Boolean);

  const resolvedTargets: ResolvedTarget[] = [];
  const addTarget = (target: ResolvedTarget) => {
    if (!resolvedTargets.some((item) => item.url === target.url)) {
      resolvedTargets.push(target);
    }
  };

  const knownSpecSuffixes = [
    "openapi.json",
    "openapi.yaml",
    "openapi.yml",
    "swagger.json",
    "swagger.yaml",
    "swagger.yml",
  ];

  for (const location of providedLocations) {
    if (/^https?:\/\//i.test(location)) {
      let normalized = location.replace(/\/+$/g, "");

      const rawRepoUrl = convertRepositoryWebUrlToRaw(normalized);
      if (rawRepoUrl) {
        normalized = rawRepoUrl;
      }

      if (/(openapi|swagger)\.(json|ya?ml)$/i.test(normalized)) {
        if (await isReachableSpecUrl(normalized)) {
          addTarget({ url: normalized, source: "provided-url" });
          continue;
        }
      }

      for (const suffix of knownSpecSuffixes) {
        const candidate = `${normalized}/${suffix}`;
        if (await isReachableSpecUrl(candidate)) {
          addTarget({ url: candidate, source: "provided-api-base" });
        }
      }
    } else {
      const normalizedPath = location.replace(/^\/+|\/+$/g, "");
      const index = lowerTree.findIndex(
        (path) => path === normalizedPath.toLowerCase()
      );
      if (index !== -1) {
        addTarget({
          url: buildRawRepoUrl(providerId, projectPath, owner, repo, branch, tree[index]),
          source: "provided-repo-path",
        });
      }
    }
  }

  if (resolvedTargets.length > 0) {
    return resolvedTargets;
  }

  const fallbackCandidates = [
    "openapi.yaml",
    "openapi.yml",
    "openapi.json",
    "swagger.yaml",
    "swagger.yml",
    "swagger.json",
    "api/openapi.yaml",
    "api/openapi.yml",
    "api/openapi.json",
    "api/swagger.yaml",
    "api/swagger.yml",
    "api/swagger.json",
    "docs/openapi.yaml",
    "docs/openapi.yml",
    "specs/openapi.yaml",
    "specs/openapi.yml",
  ];

  for (const candidate of fallbackCandidates) {
    const index = lowerTree.findIndex((path) => path === candidate);
    if (index !== -1) {
      addTarget({
        url: buildRawRepoUrl(providerId, projectPath, owner, repo, branch, tree[index]),
        source: "auto-discovered",
      });
    }
  }

  for (let i = 0; i < lowerTree.length; i += 1) {
    const path = lowerTree[i];
    if (
      path.endsWith("/openapi.yaml") ||
      path.endsWith("/openapi.yml") ||
      path.endsWith("/openapi.json") ||
      path.endsWith("/swagger.yaml") ||
      path.endsWith("/swagger.yml") ||
      path.endsWith("/swagger.json")
    ) {
      addTarget({
        url: buildRawRepoUrl(providerId, projectPath, owner, repo, branch, tree[i]),
        source: "auto-discovered",
      });
    }
  }

  return resolvedTargets;
}

export async function checkAdrValidator(
  owner: string,
  repo: string,
  projectPath: string,
  providerId: string,
  branch: string,
  tree: string[],
  apiSpecificationLocations: string[] = [],
  spectralRulesetSource?: string
): Promise<CheckResult> {
  const resolvedTargets = await resolveSpecTargetUrls(
    providerId,
    projectPath,
    owner,
    repo,
    branch,
    tree,
    apiSpecificationLocations
  );

  if (resolvedTargets.length === 0) {
    return {
      id: "adrvalidator",
      title: "API Design Rules",
      description:
        "The component should comply with the Common Ground API Design Rules (ADR).",
      status: "warn",
      message:
        "No API specification could be resolved for ADR linting. Provide an API specification URL/path.",
      evidence: apiSpecificationLocations,
      referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
    };
  }

  const resolvedRulesetSource = resolveRulesetSource(spectralRulesetSource);

  const severityCounts: SeverityCounts = { errors: 0, warnings: 0, info: 0, hints: 0 };
  let hasWarn = false;
  const evidence: string[] = [];

  for (const resolvedTarget of resolvedTargets) {
    const targetUrl = resolvedTarget.url;
    const targetSource = resolvedTarget.source;
    const targetEvidenceBase =
      targetSource === "auto-discovered"
        ? [
            `API specification was auto-discovered by the checker: ${targetUrl}`,
            `Discovery source: ${targetSource}`,
            `Spectral ruleset source: ${resolvedRulesetSource}`,
          ]
        : [
            `Lint target: ${targetUrl}`,
            `Target source: ${targetSource}`,
            `Spectral ruleset source: ${resolvedRulesetSource}`,
          ];

    const spectralArgs = [
      "lint",
      targetUrl,
      "--ruleset",
      resolvedRulesetSource,
      "--format",
      "json",
    ];

    const result = await runSpectralCommand(spectralArgs);

    if (result.code === 127) {
      return {
        id: "adrvalidator",
        title: "API Design Rules",
        description:
          "The component should comply with the Common Ground API Design Rules (ADR).",
        status: "warn",
        message:
          "Spectral CLI is not available. Ensure Node.js and npx are installed.",
        evidence: [
          ...targetEvidenceBase,
          ...result.stderr
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 5),
        ],
        referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
      };
    }

    const lintResults = parseSpectralJson(result.stdout);
    if (lintResults === null) {
      const combinedOutput = `${result.stdout}\n${result.stderr}`;
      evidence.push(...targetEvidenceBase);
      evidence.push(
        ...combinedOutput
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 10)
      );
      hasWarn = true;
      continue;
    }

    if (lintResults.length > 0) {
      addSeverityCounts(severityCounts, lintResults);
      evidence.push(...targetEvidenceBase);
      evidence.push(...lintResults.map((issue) => formatSpectralIssue(issue)));
      continue;
    }

    evidence.push(...targetEvidenceBase);
    evidence.push(`No API Design Rules violations found for ${targetUrl}.`);
  }

  const countsSummary = formatSeverityCounts(severityCounts);

  if (severityCounts.errors > 0) {
    return {
      id: "adrvalidator",
      title: "API Design Rules",
      description:
        "The component should comply with the Common Ground API Design Rules (ADR).",
      status: "fail",
      message: `API Design Rules violations found across ${resolvedTargets.length} specification(s): ${countsSummary}.`,
      evidence,
      referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
    };
  }

  if (hasWarn) {
    return {
      id: "adrvalidator",
      title: "API Design Rules",
      description:
        "The component should comply with the Common Ground API Design Rules (ADR).",
      status: "warn",
      message:
        "One or more API specifications could not be fully validated due to Spectral output parsing issues.",
      evidence,
      referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
    };
  }

  if (severityCounts.warnings > 0) {
    return {
      id: "adrvalidator",
      title: "API Design Rules",
      description:
        "The component should comply with the Common Ground API Design Rules (ADR).",
      status: "warn",
      message: `API Design Rules warnings found across ${resolvedTargets.length} specification(s): ${countsSummary}.`,
      evidence,
      referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
    };
  }

  const hasFindings = severityCounts.info + severityCounts.hints > 0;

  return {
    id: "adrvalidator",
    title: "API Design Rules",
    description:
      "The component should comply with the Common Ground API Design Rules (ADR).",
    status: "pass",
    message: `API specification(s) at ${resolvedTargets
      .map((target) => target.url)
      .join(", ")} comply with Common Ground API Design Rules${
      hasFindings ? ` (${countsSummary})` : ""
    }.`,
    evidence: [
      ...evidence,
      `Ruleset: ${ADR_RULESET_URL}`,
      hasFindings
        ? "No API Design Rules errors or warnings found by Spectral."
        : "No API Design Rules violations found by Spectral.",
    ],
    referenceUrl: "https://commonground.nl/cms/view/54476259/api-designrules",
  };
}
