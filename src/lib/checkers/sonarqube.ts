import type { RepoContext } from "../providers/types";
import type { CheckResult } from "../types";

const CHECK_ID = "sonarqube";
const TITLE = "External comparison: SonarQube";
const DESCRIPTION =
  "Reads the technical debt ratio and the open issues of four SIG-like rules from a SonarQube server that already analyses this component. Information only: never stars, never part of the score.";
const REFERENCE_URL = "https://docs.sonarsource.com/sonarqube-server/latest/extension-guide/web-api/";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_WORST_FILES = 5;
const PROPERTIES_FILE = "sonar-project.properties";

/** The SIG-like rules of the calibrated profile, in the order they are shown. */
const RULES: Array<{ key: string; label: string }> = [
  { key: "S138", label: "S138 function length" },
  { key: "S3776", label: "S3776 cognitive complexity" },
  { key: "S107", label: "S107 too many parameters" },
  { key: "S1192", label: "S1192 duplicated string literals" },
];
const RULE_REPOSITORIES = ["php", "python", "javascript", "typescript"];
const PROFILE_LANGUAGES = ["php", "py", "js", "ts"];

const NOTE =
  "Information only: not rated with stars and not counted in the score. The calibrated profile (S138 max 60, S3776 threshold 25, S107 max 6, S1192) was fitted on six repositories; its order matched the estimate with Spearman 0.94 on those six only.";

export interface SonarQubeConfig {
  url: string;
  token: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface Measure {
  metric: string;
  value?: string;
}

interface IssueSearch {
  total: number;
  facets?: Array<{ property: string; values: Array<{ val: string; count: number }> }>;
}

/** Reads SONARQUBE_URL and SONARQUBE_TOKEN; returns null unless both are set. */
export function sonarQubeConfigFromEnv(env: Record<string, string | undefined> = process.env): SonarQubeConfig | null {
  const url = env.SONARQUBE_URL?.trim().replace(/\/+$/, "");
  const token = env.SONARQUBE_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

/** The `sonar.projectKey` a sonar-project.properties file declares, if any. */
export function declaredProjectKey(properties: string): string | undefined {
  for (const line of properties.split(/\r?\n/)) {
    const match = line.match(/^\s*sonar\.projectKey\s*[=:]\s*(.+?)\s*$/);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Project keys to look up, in order: the key the repository declares in
 * sonar-project.properties, then `<owner>_<repo>` (the SonarQube Cloud
 * convention) and the bare repository name.
 */
export function projectKeyCandidates(owner: string, repo: string, declared?: string): string[] {
  const keys = [declared, `${owner.replace(/\//g, "_")}_${repo}`, repo].filter(
    (key): key is string => Boolean(key)
  );
  return [...new Set(keys)];
}

function ruleList(rule: string): string {
  return RULE_REPOSITORIES.map((repository) => `${repository}:${rule}`).join(",");
}

/** Formats a debt ratio in percent with enough digits to tell small ratios apart. */
export function formatDebtRatio(percent: number): string {
  if (percent === 0) return "0 %";
  return `${percent >= 1 ? percent.toFixed(1) : percent.toPrecision(2)} %`;
}

type Get = <T>(path: string, text?: boolean) => Promise<T | null>;

/** A GET on the configured server; it returns null on 404 and throws on any other error. */
function sonarQubeGet(config: SonarQubeConfig, fetchImpl: FetchLike): Get {
  return async <T>(path: string, text = false): Promise<T | null> => {
    const response = await fetchImpl(`${config.url}${path}`, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: text ? "text/plain" : "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`SonarQube returned HTTP ${response.status} for ${path.split("?")[0]}.`);
    return (text ? await response.text() : await response.json()) as T;
  };
}

async function findProjectKey(get: Get, candidates: string[]): Promise<string | null> {
  for (const key of candidates) {
    const found = await get(`/api/components/show?component=${encodeURIComponent(key)}`);
    if (found) return key;
  }
  return null;
}

async function readDeclaredKey(context: RepoContext, tree: string[]): Promise<string | undefined> {
  if (!tree.includes(PROPERTIES_FILE)) return undefined;
  const content = await context.provider.getFileContent(context, PROPERTIES_FILE);
  return content ? declaredProjectKey(content) : undefined;
}

function debtRatioPercent(measures: Measure[]): number | null {
  const value = (metric: string) => {
    const raw = measures.find((measure) => measure.metric === metric)?.value;
    return raw === undefined ? null : Number(raw);
  };
  // The debt ratios are rounded to one decimal, which shows 0.0 % for most components, so the ratio
  // is recomputed from the effort; the Multi-Quality Rule effort is the one the profile was calibrated on.
  const effort = value("software_quality_maintainability_remediation_effort") ?? value("sqale_index");
  const cost = value("development_cost");
  if (effort !== null && cost) return (effort / cost) * 100;
  return value("sqale_debt_ratio");
}

/**
 * Compares the component with the SonarQube configured through SONARQUBE_URL
 * and SONARQUBE_TOKEN. Returns null when no SonarQube is configured or it
 * holds no project for the component, so no result is shown.
 */
export async function checkSonarQube(
  context: RepoContext,
  tree: string[],
  config: SonarQubeConfig | null = sonarQubeConfigFromEnv(),
  fetchImpl: FetchLike = fetch
): Promise<CheckResult | null> {
  if (!config) return null;
  const get = sonarQubeGet(config, fetchImpl);

  try {
    const declared = await readDeclaredKey(context, tree);
    const key = await findProjectKey(get, projectKeyCandidates(context.owner, context.repo, declared));
    if (!key) return null;

    const component = encodeURIComponent(key);
    const issuesPath = (rules: string, facets: string) =>
      `/api/issues/search?components=${component}&rules=${rules}&issueStatuses=OPEN,CONFIRMED&ps=1${facets}`;
    const [measures, issues, ruleTotals, profiles, version] = await Promise.all([
      get<{ component: { measures: Measure[] } }>(
        `/api/measures/component?component=${component}&metricKeys=sqale_debt_ratio,sqale_index,software_quality_maintainability_remediation_effort,development_cost,ncloc`
      ),
      get<IssueSearch>(issuesPath(RULES.map((rule) => ruleList(rule.key)).join(","), "&facets=files")),
      // The rules facet ignores the rules filter and lists only the top rules, so each rule is counted on its own.
      Promise.all(RULES.map((rule) => get<IssueSearch>(issuesPath(ruleList(rule.key), "")))),
      get<{ profiles: Array<{ name: string; language: string }> }>(
        `/api/qualityprofiles/search?project=${component}`
      ).catch(() => null),
      get<string>("/api/server/version", true).catch(() => null),
    ]);
    if (!measures || !issues) return null;

    const ratio = debtRatioPercent(measures.component.measures);
    const ncloc = measures.component.measures.find((measure) => measure.metric === "ncloc")?.value;
    const declaredNote = key === declared ? `from ${PROPERTIES_FILE}` : "derived from the repository URL";

    const evidence = RULES.map((rule, index) => `${rule.label}: ${ruleTotals[index]?.total ?? 0} open issue(s)`);
    const files = issues.facets?.find((facet) => facet.property === "files")?.values ?? [];
    evidence.push(
      ...files.slice(0, MAX_WORST_FILES).map((file) => `Worst file: ${file.val} (${file.count} issue(s))`)
    );
    const codeProfiles = (profiles?.profiles ?? []).filter((profile) => PROFILE_LANGUAGES.includes(profile.language));
    if (codeProfiles.length) {
      evidence.push(
        `Quality profile: ${codeProfiles.map((profile) => `${profile.name} (${profile.language})`).join(", ")}`
      );
    }
    evidence.push(`Project key ${key} (${declaredNote})${version ? ` on SonarQube ${version.trim()}` : ""}`);
    evidence.push(NOTE);

    const ratioText = ratio === null ? "not reported" : formatDebtRatio(ratio);
    return {
      id: CHECK_ID,
      title: TITLE,
      description: DESCRIPTION,
      status: "info",
      message:
        `Technical debt ratio ${ratioText}${ncloc ? ` over ${Number(ncloc).toLocaleString("en-US")} lines of code` : ""}; ` +
        `${issues.total} open issue(s) of the four SIG-like rules. Information only, never stars.`,
      evidence,
      referenceUrl: REFERENCE_URL,
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `SonarQube did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`
        : (error as Error).message;
    return {
      id: CHECK_ID,
      title: TITLE,
      description: DESCRIPTION,
      status: "info",
      message: "The configured SonarQube could not be read, so there is no external comparison.",
      evidence: [reason],
      referenceUrl: REFERENCE_URL,
    };
  }
}
