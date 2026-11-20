import type { CheckResult, CheckStatus } from "../types";
import type { RepoContext } from "../providers/types";
import { MAX_RATING, MIN_RATING } from "../ratings";

/**
 * The AI readiness criteria: how easy it is for a coding agent to start on a
 * repository. Each one reads the tree of the scanned commit and, for a few
 * root files, their contents. They are informative and never count in the
 * overall rating or the verdict.
 */
export const AI_READINESS_CHECK_IDS = [
  "agentinstructions",
  "specifications",
  "architecturedecisions",
  "devenvironment",
  "machineinterfaces",
  "agenttooling",
] as const;

/** File contents by path, for the files readAiReadinessFiles reads. */
export type FileContents = Record<string, string>;

const REFERENCE_URL = "https://agents.md/";
/** Root instruction files whose contents are read, at most this many. */
const MAX_INSTRUCTION_FILES = 5;
const SUBSTANTIAL_INSTRUCTIONS = 1000;
const DETAILED_INSTRUCTIONS = 4000;

/** Paths that hold someone else's code or test data, never the repository's own setup. */
const FOREIGN_PATH = /(^|\/)(node_modules|vendor|third_party|bower_components|\.git)\/|(^|\/)(tests?|fixtures?|__tests__|spec\/fixtures)\//i;

function rated(points: number): number {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, MIN_RATING + points));
}

function statusOf(rating: number): CheckStatus {
  if (rating >= 4) return "pass";
  return rating >= 2 ? "warn" : "fail";
}

function result(
  id: (typeof AI_READINESS_CHECK_IDS)[number],
  title: string,
  description: string,
  rating: number,
  message: string,
  evidence: string[]
): CheckResult {
  return {
    id,
    title,
    description,
    status: statusOf(rating),
    rating,
    message,
    evidence,
    referenceUrl: REFERENCE_URL,
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const INSTRUCTION_FILE =
  /^(?:(?:.*\/)?(?:agents|claude|gemini)\.md|\.github\/copilot-instructions\.md|\.github\/instructions\/[^/]+\.instructions\.md|\.cursor\/rules\/[^/]+|\.cursorrules|\.windsurfrules|\.clinerules(?:\/[^/]+)?)$/i;

/** Agent instruction files in the tree, root files first. */
export function findInstructionFiles(tree: string[]): string[] {
  const found = tree.filter((path) => INSTRUCTION_FILE.test(path) && !FOREIGN_PATH.test(path));
  const depth = (path: string) => path.split("/").length;
  return found.sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
}

/** A build, test or lint command an agent can run, as instruction files name them. */
const COMMAND =
  /\b(?:npm|pnpm|yarn|npx|composer|make|just|task|mvn|gradle|gradlew|cargo|go (?:test|build|vet)|pytest|tox|nox|phpunit|vitest|jest|ruff|eslint|docker compose|docker-compose|dotnet|bundle exec|rake|python -m)\b/i;

export function checkAgentInstructions(tree: string[], files: FileContents): CheckResult {
  const title = "Agent instructions";
  const description =
    "An AGENTS.md, CLAUDE.md, Copilot or Cursor instruction file tells a coding agent how the repository is built, tested and organised.";
  const paths = findInstructionFiles(tree);
  if (paths.length === 0) {
    return result(
      "agentinstructions",
      title,
      description,
      MIN_RATING,
      "No agent instruction file found. Add an AGENTS.md that says how to build, test and lint the code.",
      []
    );
  }
  const read = paths.filter((path) => typeof files[path] === "string");
  const longest = Math.max(0, ...read.map((path) => files[path].length));
  const commands = read.some((path) => COMMAND.test(files[path]));
  const points =
    1 +
    (longest >= SUBSTANTIAL_INSTRUCTIONS ? 1 : 0) +
    (longest >= DETAILED_INSTRUCTIONS ? 1 : 0) +
    (commands ? 2 : 0);
  const size = read.length > 0 ? `; the longest has ${longest.toLocaleString("en-GB")} characters` : "";
  return result(
    "agentinstructions",
    title,
    description,
    rated(points),
    `${plural(paths.length, "instruction file")} found${size}; ${commands ? "names" : "does not name"} a build, test or lint command.`,
    paths
  );
}

const OPENSPEC_SPEC = /^(?:.*\/)?openspec\/specs\/.+\/spec\.md$/i;
const OPENSPEC_CHANGE = /^(?:.*\/)?openspec\/changes\/(?:archive\/)?([^/]+)\/[^/]+$/i;
const SPEC_KIT_SPEC = /^(?:\.specify\/specs|specs)\/[^/]+\/spec\.md$/i;
const KIRO_SPEC = /^\.kiro\/specs\/[^/]+\/(?:requirements|design)\.md$/i;

/** Rating by number of specifications: 1 is 2, 5 is 3, 10 is 4, 25 is 5. */
const SPEC_BANDS: Array<[minimum: number, rating: number]> = [
  [25, 5],
  [10, 4],
  [5, 3],
  [1, 2],
];

export function checkSpecifications(tree: string[]): CheckResult {
  const title = "Specifications";
  const description =
    "Specifications in a known layout (OpenSpec, Spec Kit or Kiro) tell a coding agent what the code must do and which changes are under way.";
  const specs = tree.filter(
    (path) => (OPENSPEC_SPEC.test(path) || SPEC_KIT_SPEC.test(path) || KIRO_SPEC.test(path)) && !FOREIGN_PATH.test(path)
  );
  const kiroFeatures = new Set(specs.filter((path) => KIRO_SPEC.test(path)).map((path) => path.split("/")[2]));
  const specCount = specs.filter((path) => !KIRO_SPEC.test(path)).length + kiroFeatures.size;
  const changes = new Set(
    tree.flatMap((path) => {
      const match = OPENSPEC_CHANGE.exec(path);
      return match && match[1].toLowerCase() !== "archive" && !FOREIGN_PATH.test(path) ? [match[1]] : [];
    })
  );
  if (specCount === 0) {
    return result(
      "specifications",
      title,
      description,
      MIN_RATING,
      "No specifications found. Describe the behaviour in openspec/specs/<capability>/spec.md.",
      []
    );
  }
  const band = SPEC_BANDS.find(([minimum]) => specCount >= minimum)?.[1] ?? MIN_RATING;
  const rating = Math.min(MAX_RATING, band + (changes.size > 0 ? 0.5 : 0));
  return result(
    "specifications",
    title,
    description,
    rating,
    `${plural(specCount, "specification")} and ${plural(changes.size, "change")} found.`,
    specs
  );
}

const ADR_DIRECTORY =
  /^(?:.*\/)?(?:docs?\/(?:adrs?|decisions|architecture\/decisions|architecture-decisions)|adrs?|decisions|openspec\/architecture)\/(?:[^/]+\/)*([^/]+)$/i;
const NUMBERED_RECORD = /^(?:adr[-_ ]?)?\d{1,4}[-_ .][^/]*\.(?:md|markdown|rst|adoc|txt)$/i;

/** Rating by number of decision records: 1 is 2, 3 is 3, 5 is 4, 10 is 5.5. */
const ADR_BANDS: Array<[minimum: number, rating: number]> = [
  [10, MAX_RATING],
  [5, 4],
  [3, 3],
  [1, 2],
];

/** Numbered architecture decision records in an ADR directory. */
export function findDecisionRecords(tree: string[]): string[] {
  return tree.filter((path) => {
    const match = ADR_DIRECTORY.exec(path);
    return !!match && NUMBERED_RECORD.test(match[1]) && !FOREIGN_PATH.test(path);
  });
}

export function checkArchitectureDecisions(tree: string[]): CheckResult {
  const title = "Architecture decision records";
  const description =
    "Numbered architecture decision records tell a coding agent which choices were made and why, so it does not undo them.";
  const records = findDecisionRecords(tree);
  if (records.length === 0) {
    return result(
      "architecturedecisions",
      title,
      description,
      MIN_RATING,
      "No architecture decision records found. Record decisions as numbered files in docs/adr.",
      []
    );
  }
  const rating = ADR_BANDS.find(([minimum]) => records.length >= minimum)?.[1] ?? MIN_RATING;
  return result(
    "architecturedecisions",
    title,
    description,
    rating,
    `${plural(records.length, "decision record")} found.`,
    records
  );
}

const DEV_CONTAINER = /^(?:\.devcontainer\/(?:[^/]+\/)?devcontainer\.json|\.devcontainer\.json)$/i;
const COMPOSE_FILE = /^(?:.*\/)?(?:docker-)?compose(?:[.-][^/]*)?\.ya?ml$/i;

/** Root files that declare commands, read for their contents. */
export const COMMAND_FILES = [
  "package.json",
  "composer.json",
  "Makefile",
  "makefile",
  "GNUmakefile",
  "justfile",
  "Justfile",
  "Taskfile.yml",
  "Taskfile.yaml",
  "pyproject.toml",
  "tox.ini",
  "noxfile.py",
];

/** Build files whose tool gives build and test commands by convention. */
const CONVENTIONAL_BUILD_FILES = ["pom.xml", "build.gradle", "build.gradle.kts", "go.mod", "Cargo.toml", "mix.exs"];

type Verb = "test" | "lint" | "build";
const VERBS: Verb[] = ["test", "lint", "build"];

const VERB_PATTERN: Record<Verb, RegExp> = {
  test: /^(?:test|tests|unit|phpunit|pytest|spec|check|e2e)(?:[:_-].*)?$/i,
  lint: /^(?:lint|cs|phpcs|cs:check|format|fmt|stylelint|eslint|psalm|phpstan|typecheck|check:strict|style)(?:[:_-].*)?$/i,
  build: /^(?:build|compile|dist|package|bundle)(?:[:_-].*)?$/i,
};

function scriptNames(path: string, content: string): string[] {
  const name = path.split("/").pop() ?? path;
  if (name === "package.json" || name === "composer.json") {
    try {
      const scripts = (JSON.parse(content) as { scripts?: unknown }).scripts;
      return scripts && typeof scripts === "object" && !Array.isArray(scripts) ? Object.keys(scripts) : [];
    } catch {
      return [];
    }
  }
  if (/makefile$/i.test(name)) return [...content.matchAll(/^([A-Za-z0-9_.:-]+)\s*:(?!=)/gm)].map((m) => m[1]);
  if (/^justfile$/i.test(name)) return [...content.matchAll(/^@?([A-Za-z0-9_-]+)[^:\n=]*:(?!=)/gm)].map((m) => m[1]);
  if (/^taskfile\.ya?ml$/i.test(name)) return [...content.matchAll(/^ {2}([A-Za-z0-9_:-]+):\s*$/gm)].map((m) => m[1]);
  if (name === "pyproject.toml") {
    return [
      ...(/\[tool\.(?:pytest|tox|nox)/.test(content) ? ["test"] : []),
      ...(/\[tool\.(?:ruff|flake8|pylint|black|mypy)/.test(content) ? ["lint"] : []),
      ...(/\[build-system\]/.test(content) ? ["build"] : []),
    ];
  }
  if (name === "tox.ini" || name === "noxfile.py") {
    return ["test", ...(/\b(?:lint|flake8|ruff|pylint)\b/.test(content) ? ["lint"] : [])];
  }
  return [];
}

export function checkDevEnvironment(tree: string[], files: FileContents): CheckResult {
  const title = "Runnable development environment";
  const description =
    "A dev container or Docker Compose file, and one command each to test, lint and build, let a coding agent run and check its own changes.";
  const environment = tree.filter(
    (path) => (DEV_CONTAINER.test(path) || COMPOSE_FILE.test(path)) && !FOREIGN_PATH.test(path)
  );
  const found = new Map<Verb, string>();
  for (const path of COMMAND_FILES) {
    const content = files[path];
    if (typeof content !== "string") continue;
    for (const script of scriptNames(path, content)) {
      for (const verb of VERBS) {
        if (!found.has(verb) && VERB_PATTERN[verb].test(script)) found.set(verb, `${path}: ${script}`);
      }
    }
  }
  const conventional = CONVENTIONAL_BUILD_FILES.filter((path) => tree.includes(path));
  for (const verb of ["test", "build"] as Verb[]) {
    if (!found.has(verb) && conventional.length > 0) found.set(verb, `${conventional[0]}: ${verb} by convention`);
  }
  const points = (environment.length > 0 ? 2 : 0) + found.size;
  const missing = VERBS.filter((verb) => !found.has(verb));
  const message = [
    environment.length > 0 ? "Development environment found" : "No dev container or Docker Compose file found",
    missing.length === 0 ? "commands to test, lint and build found." : `no command found to ${missing.join(", ")}.`,
  ].join("; ");
  return result("devenvironment", title, description, rated(points), message, [
    ...environment.slice(0, 10),
    ...found.values(),
  ]);
}

const OPENAPI_FILE = /(?:^|\/)(?:openapi|swagger)[^/]*\.(?:json|ya?ml)$/i;
const LLMS_TXT = /^(?:.*\/)?llms(?:-full)?\.txt$/i;
const MCP_CONFIG = /^(?:\.mcp\.json|mcp\.json|\.vscode\/mcp\.json|\.cursor\/mcp\.json|\.gemini\/settings\.json)$/i;

export function checkMachineInterfaces(tree: string[]): CheckResult {
  const title = "Machine-readable interfaces";
  const description =
    "An OpenAPI document, an llms.txt and an MCP configuration let a coding agent read the interfaces and tools instead of guessing them.";
  const own = tree.filter((path) => !FOREIGN_PATH.test(path));
  const openapi = own.filter((path) => OPENAPI_FILE.test(path));
  const llms = own.filter((path) => LLMS_TXT.test(path));
  const mcp = own.filter((path) => MCP_CONFIG.test(path));
  const points = (openapi.length > 0 ? 3 : 0) + (llms.length > 0 ? 1 : 0) + (mcp.length > 0 ? 1 : 0);
  const kinds = [
    openapi.length > 0 ? plural(openapi.length, "OpenAPI document") : null,
    llms.length > 0 ? "llms.txt" : null,
    mcp.length > 0 ? "MCP configuration" : null,
  ].filter((kind): kind is string => kind !== null);
  return result(
    "machineinterfaces",
    title,
    description,
    rated(points),
    kinds.length > 0
      ? `Found: ${kinds.join(", ")}.`
      : "No OpenAPI document, llms.txt or MCP configuration found.",
    [...openapi.slice(0, 10), ...llms, ...mcp]
  );
}

const SKILL_FILE =
  /^(?:\.claude\/skills\/[^/]+\/SKILL\.md|\.agents\/skills\/[^/]+\/SKILL\.md|\.claude\/(?:commands|agents)\/.+\.md|\.github\/prompts\/[^/]+\.prompt\.md|\.github\/(?:chatmodes|agents)\/[^/]+\.md|\.cursor\/commands\/[^/]+\.md)$/i;
const GATE_FILE =
  /^(?:\.pre-commit-config\.ya?ml|\.husky\/[^/_][^/]*|lefthook\.ya?ml|\.lefthook\.ya?ml|(?:scripts|bin|tools)\/[^/]*(?:gate|check|verify|lint)[^/]*\.(?:sh|py|js|mjs|ts|php))$/i;

/** Points by number of skills, prompts and commands: 1 is 1, 3 is 2, 10 is 3. */
const SKILL_BANDS: Array<[minimum: number, points: number]> = [
  [10, 3],
  [3, 2],
  [1, 1],
];

export function checkAgentTooling(tree: string[]): CheckResult {
  const title = "Agent tooling";
  const description =
    "Skills, prompts and commands for coding agents, and quality gates they can run locally, turn the team's way of working into steps an agent repeats.";
  const skills = tree.filter((path) => SKILL_FILE.test(path));
  const gates = tree.filter((path) => GATE_FILE.test(path));
  const skillPoints = SKILL_BANDS.find(([minimum]) => skills.length >= minimum)?.[1] ?? 0;
  const points = skillPoints + (gates.length > 0 ? 2 : 0);
  return result(
    "agenttooling",
    title,
    description,
    rated(points),
    `Skills, prompts or commands: ${skills.length}; local quality gates: ${gates.length}.`,
    [...skills.slice(0, 10), ...gates.slice(0, 10)]
  );
}

/** The root files the AI readiness criteria read: instruction files and command files. */
export function aiReadinessFilesToRead(tree: string[]): string[] {
  const instructions = findInstructionFiles(tree).slice(0, MAX_INSTRUCTION_FILES);
  const commands = COMMAND_FILES.filter((path) => tree.includes(path));
  return [...instructions, ...commands];
}

export async function readAiReadinessFiles(
  read: (path: string) => Promise<string | null>,
  tree: string[]
): Promise<FileContents> {
  const entries = await Promise.all(
    aiReadinessFilesToRead(tree).map(async (path) => [path, await read(path).catch(() => null)] as const)
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => typeof entry[1] === "string"));
}

/** Every AI readiness criterion for a repository. */
export async function checkAiReadiness(
  context: RepoContext,
  tree: string[],
  read: (path: string) => Promise<string | null> = (path) => context.provider.getFileContent(context, path)
): Promise<CheckResult[]> {
  const files = await readAiReadinessFiles(read, tree);
  return [
    checkAgentInstructions(tree, files),
    checkSpecifications(tree),
    checkArchitectureDecisions(tree),
    checkDevEnvironment(tree, files),
    checkMachineInterfaces(tree),
    checkAgentTooling(tree),
  ];
}
