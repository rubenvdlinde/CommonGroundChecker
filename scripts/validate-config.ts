/**
 * Checks the component list and the SLAs, for the pull request check.
 *
 *   npm run --silent config:check -- [--base FILE] [--offline]
 *
 * --base is the component list before the change (for example from
 * `git show origin/main:config/repositories.yml`); only new or changed
 * entries are checked online then. --offline skips the online checks.
 * Exit codes: 0 valid (warnings allowed), 1 invalid, 2 could not check.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseYaml, repositoryPath, type RepositoriesConfig } from "../src/lib/staticSite/config";
import { changedEntries, checkConfig, checkRemote, type Finding, type RemoteChecks } from "../src/lib/staticSite/validate";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLICCODE_FILES = ["publiccode.yml", "publiccode.yaml"];

async function isPublic(url: string): Promise<boolean> {
  try {
    await run("git", ["ls-remote", "--exit-code", url, "HEAD"], {
      timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "/bin/false" },
    });
    return true;
  } catch {
    return false;
  }
}

async function exists(url: string, headers: Record<string, string> = {}): Promise<boolean> {
  const response = await fetch(url, { method: "HEAD", headers, redirect: "follow" });
  return response.ok;
}

async function publiccodeFile(url: string): Promise<string | null | undefined> {
  const { host, owner, repo } = repositoryPath(url);
  if (host === "github.com") {
    for (const file of PUBLICCODE_FILES) {
      if (await exists(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`)) return file;
    }
    return null;
  }
  if (host === "gitlab.com") {
    const project = `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}`;
    const response = await fetch(project);
    if (!response.ok) return undefined;
    const branch = ((await response.json()) as { default_branch?: string }).default_branch ?? "main";
    for (const file of PUBLICCODE_FILES) {
      if (await exists(`${project}/repository/files/${encodeURIComponent(file)}?ref=${encodeURIComponent(branch)}`)) return file;
    }
    return null;
  }
  return undefined;
}

export const remoteChecks: RemoteChecks = { isPublic, publiccodeFile };

function readYaml(file: string): unknown {
  return parseYaml(readFileSync(file, "utf-8"));
}

function print(findings: Finding[]) {
  for (const finding of findings) {
    const line = `${finding.subject}: ${finding.message}`;
    // GitHub and Forgejo Actions show these as annotations on the pull request.
    process.stdout.write(`::${finding.level} title=config::${line}\n`);
  }
}

async function main(argv: string[]): Promise<number> {
  const baseIndex = argv.indexOf("--base");
  const baseFile = baseIndex >= 0 ? argv[baseIndex + 1] : undefined;
  const offline = argv.includes("--offline");

  let repositories: unknown;
  let slas: unknown;
  try {
    repositories = readYaml(path.join(ROOT, "config/repositories.yml"));
    slas = readYaml(path.join(ROOT, "config/slas.yml"));
  } catch (error) {
    process.stderr.write(`config:check: ${(error as Error).message}\n`);
    return 2;
  }

  const findings = checkConfig(repositories, slas);
  if (!findings.some((finding) => finding.level === "error") && !offline) {
    let base: RepositoriesConfig | null = null;
    if (baseFile) {
      try {
        base = readYaml(baseFile) as RepositoriesConfig;
      } catch {
        base = null;
      }
    }
    const entries = changedEntries(repositories as RepositoriesConfig, base);
    process.stdout.write(`Checking ${entries.length} new or changed ${entries.length === 1 ? "entry" : "entries"} online.\n`);
    findings.push(...(await checkRemote(entries, remoteChecks)));
  }

  print(findings);
  const errors = findings.filter((finding) => finding.level === "error").length;
  const warnings = findings.length - errors;
  process.stdout.write(`${errors} ${errors === 1 ? "error" : "errors"}, ${warnings} ${warnings === 1 ? "warning" : "warnings"}.\n`);
  return errors > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
