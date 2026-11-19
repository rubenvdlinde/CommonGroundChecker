import type { RepoContext, RepositoryMeta } from "../providers/types";
import type { CheckResult, InformativeMetric } from "../types";
import { fetchGitHubActivity } from "../projectActivity/github";
import { fetchGitLabActivity } from "../projectActivity/gitlab";
import { profileLookupLimit } from "../contributorOrganisations";
import { fetchGitHubSlaInput } from "../projectActivity/slaGithub";
import { withKpiTargets } from "../kpi";
import {
  DEFAULT_KPI_TARGETS,
  DEFAULT_SLA_TERMS,
  effectiveSlaLabels,
  type KpiTarget,
  type SlaCategory,
  type SlaTerm,
} from "../maintenanceTerms";
import { slaNotMeasured, summarizeSla } from "../sla";
import type { SlaSummary } from "../types";
import { DAY_MS, type CommitDomains, type Measured, type ProjectActivity, type Releases, type ResponseSet } from "../projectActivity/types";

export const PROJECT_HEALTH_CHECK_ID = "projecthealth";

const CHAOSS_METRICS = "https://chaoss.community/kb-metrics-and-metrics-models/";

function chaossUrl(slug: string): string {
  return `https://chaoss.community/kb/metric-${slug}/`;
}

const numberFormat = new Intl.NumberFormat("en-GB");


/**
 * CHAOSS Contributor Absence Factor: the smallest number of contributors that
 * together made half of the commits. Null without commits.
 */
export function contributorAbsenceFactor(counts: number[]): number | null {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;
  let cumulative = 0;
  const sorted = [...counts].sort((a, b) => b - a);
  for (let index = 0; index < sorted.length; index += 1) {
    cumulative += sorted[index];
    if (cumulative * 2 >= total) return index + 1;
  }
  return sorted.length;
}

export interface OrganisationShares {
  /** Commits whose author has a known organisation */
  attributed: number;
  /** Commits whose author's organisation is unknown */
  unattributed: number;
  organisations: number;
  /** The largest organisation, shown only when it has at least two authors */
  largestDomain: string | null;
  largestShare: number | null;
  largestAuthors: number;
  /** Distinct authors, and those whose organisation is unknown */
  authors: number;
  unknownAuthors: number;
}

/** Commits per organisation; commits by authors of unknown organisation count apart. */
export function organisationShares(commits: CommitDomains["commits"]): OrganisationShares {
  const perOrganisation = new Map<string, { commits: number; authors: Set<number> }>();
  const authors = new Set<number>();
  const unknownAuthors = new Set<number>();
  let unattributed = 0;
  for (const { organisation, author } of commits) {
    authors.add(author);
    if (organisation === null) {
      unattributed += 1;
      unknownAuthors.add(author);
      continue;
    }
    const entry = perOrganisation.get(organisation) ?? { commits: 0, authors: new Set<number>() };
    entry.commits += 1;
    entry.authors.add(author);
    perOrganisation.set(organisation, entry);
  }
  const attributed = commits.length - unattributed;
  const ranked = [...perOrganisation.entries()].sort((a, b) => b[1].commits - a[1].commits);
  const largest = ranked[0];
  return {
    attributed,
    unattributed,
    organisations: perOrganisation.size,
    largestDomain: largest && largest[1].authors.size >= 2 ? largest[0] : null,
    largestShare: largest && attributed > 0 ? largest[1].commits / attributed : null,
    largestAuthors: largest ? largest[1].authors.size : 0,
    authors: authors.size,
    unknownAuthors: unknownAuthors.size,
  };
}

/** "conduction.nl" for a domain, "the company maykin media" style text for a profile company. */
function organisationLabel(organisation: string): string {
  return organisation.startsWith("company:") ? `the profile company ${organisation.slice("company:".length)}` : organisation;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** "45 minutes", "6.5 hours" or "3.2 days". */
export function formatDuration(ms: number): string {
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} minutes`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

function plural(count: number, noun: string): string {
  return `${numberFormat.format(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function notMeasuredMetric(base: Omit<InformativeMetric, "value" | "explanation">, reason: string): InformativeMetric {
  return { ...base, value: null, explanation: `Not measured: ${reason}.` };
}

function absenceMetric(data: Measured<{ counts: number[]; scope: string }>): InformativeMetric {
  const base = {
    id: "contributor-absence-factor",
    name: "Contributor Absence Factor",
    referenceUrl: chaossUrl("contributor-absence-factor"),
  };
  if (!data.measured) return notMeasuredMetric(base, data.reason);
  const factor = contributorAbsenceFactor(data.value.counts);
  if (factor === null) return notMeasuredMetric(base, "no commits by people in the last 12 months");
  return {
    ...base,
    value: String(factor),
    explanation: `The fewest people who together made half of ${data.value.scope}, among ${plural(data.value.counts.length, "human contributor")}. At 1 the project depends on a single person. Bots are left out; one person with several accounts or addresses counts more than once.`,
  };
}

function diversityMetric(data: Measured<CommitDomains>): InformativeMetric {
  const base = {
    id: "organizational-diversity",
    name: "Organizational Diversity",
    referenceUrl: chaossUrl("organizational-diversity"),
  };
  if (!data.measured) return notMeasuredMetric(base, data.reason);
  const shares = organisationShares(data.value.commits);
  const total = data.value.commits.length;
  if (total === 0) return notMeasuredMetric(base, "no commits by people in the last 12 months");
  if (shares.unknownAuthors * 2 > shares.authors) {
    return notMeasuredMetric(
      base,
      `organisation unknown for most contributors (${shares.unknownAuthors} of ${shares.authors})${notLookedUpText(data.value)}`
    );
  }
  if (shares.attributed === 0 || shares.largestShare === null) {
    return notMeasuredMetric(base, `the organisation of all ${total} sampled commits is unknown`);
  }
  const largest = shares.largestDomain
    ? `${organisationLabel(shares.largestDomain)} (${shares.largestAuthors} authors)`
    : "an organisation with one author";
  const lookups = data.value.lookupAvailable
    ? "for a personal or hidden address, by the company on the author's public profile"
    : "the forge does not say which account made a commit, so personal and hidden addresses stay unknown";
  return {
    ...base,
    value: `${shares.organisations} ${shares.organisations === 1 ? "organisation" : "organisations"}; largest ${percent(shares.largestShare)}`,
    explanation: `Organisations are told apart by the email domain of ${data.value.scope} (${plural(total, "commit")} by people, after the .mailmap) and, ${lookups}. The largest is ${largest}, with ${percent(shares.largestShare)} of the ${shares.attributed} commits whose organisation is known; ${percent(shares.unattributed / total)} of the commits come from ${shares.unknownAuthors} of ${shares.authors} authors whose organisation stays unknown.${notLookedUpText(data.value)} Only these counts are kept, no names, addresses or companies; an organisation is named only when several authors share it.`,
  };
}

function notLookedUpText(value: CommitDomains): string {
  return value.notLookedUp > 0 ? `; ${value.notLookedUp} not looked up, because a scan looks up at most ${profileLookupLimit()} profiles` : "";
}

function closureMetric(data: Measured<{ opened: number; closed: number }>): InformativeMetric {
  const base = {
    id: "change-request-closure-ratio",
    name: "Change Request Closure Ratio",
    referenceUrl: chaossUrl("change-request-closure-ratio"),
  };
  if (!data.measured) return notMeasuredMetric(base, data.reason);
  const { opened, closed } = data.value;
  if (opened === 0) return notMeasuredMetric(base, "no change requests were opened in the last 90 days");
  return {
    ...base,
    value: (closed / opened).toFixed(2),
    explanation: `${numberFormat.format(closed)} change requests were closed (merged or not) and ${numberFormat.format(opened)} opened in the last 90 days, bots included. Below 1 the open backlog grows; above 1 it shrinks.`,
  };
}

function responseMetric(
  data: Measured<ResponseSet>,
  base: Omit<InformativeMetric, "value" | "explanation">,
  items: string,
  response: string
): InformativeMetric {
  if (!data.measured) return notMeasuredMetric(base, data.reason);
  const { samples, from, to } = data.value;
  if (samples.length === 0) return notMeasuredMetric(base, `no ${items} were opened by people between ${from} and ${to}`);
  const waits = samples.flatMap((sample) =>
    sample.firstResponseAt ? [Date.parse(sample.firstResponseAt) - Date.parse(sample.createdAt)] : []
  );
  const unanswered = samples.length - waits.length;
  const middle = median(waits.map((wait) => Math.max(0, wait)));
  const scope = `the ${samples.length} latest ${items} opened by people between ${from} and ${to}`;
  if (middle === null) {
    return { ...base, value: "no response", explanation: `None of ${scope} got a ${response} from anyone but its author.` };
  }
  return {
    ...base,
    value: `median ${formatDuration(middle)}`,
    explanation: `The median time to the first ${response} by someone other than the author, over ${scope}. ${waits.length} got a response; ${unanswered} had none yet. Bots are left out.`,
  };
}

function releaseMetric(data: Measured<Releases>, now: Date): InformativeMetric {
  const base = { id: "release-frequency", name: "Release Frequency", referenceUrl: chaossUrl("release-frequency") };
  if (!data.measured) return notMeasuredMetric(base, data.reason);
  const yearStart = now.getTime() - 365 * DAY_MS;
  const { dates, prereleases, complete, source } = data.value;
  const inYear = (date: string) => Date.parse(date) >= yearStart;
  const recent = dates.filter(inYear).length;
  const recentPre = prereleases.filter(inYear).length;
  const atLeast = complete ? "" : "at least ";
  const interval = complete && recent >= 2 ? `, about one every ${Math.round(365 / recent)} days` : "";
  const latest = dates[0] ? ` The latest final release is from ${dates[0].slice(0, 10)}.` : "";
  const pre =
    recentPre > 0
      ? ` Besides these, ${atLeast}${numberFormat.format(recentPre)} pre-releases were published; they are not counted.`
      : "";
  const partial = complete ? "" : " The API was read for the newest releases only, so the count is a lower bound.";
  return {
    ...base,
    value: `${atLeast}${recent} in 12 months`,
    explanation: `${atLeast}${recent} final ${recent === 1 ? "release was" : "releases were"} published in the last 12 months${interval}, counted from the ${source}.${latest}${pre}${partial} Drafts and pre-releases are left out.`,
  };
}

/** The six CHAOSS metrics of the light project health set, from the activity a forge reports. */
export function projectHealthMetrics(activity: ProjectActivity, now: Date): InformativeMetric[] {
  return [
    absenceMetric(activity.contributorCommits),
    diversityMetric(activity.commitDomains),
    closureMetric(activity.changeRequests),
    responseMetric(
      activity.changeRequestResponses,
      { id: "time-to-first-response", name: "Time to First Response", referenceUrl: chaossUrl("time-to-first-response") },
      "change requests",
      "comment or review"
    ),
    responseMetric(
      activity.issueResponses,
      { id: "issue-response-time", name: "Issue Response Time", referenceUrl: chaossUrl("issue-response-time") },
      "issues",
      "comment"
    ),
    releaseMetric(activity.releases, now),
  ];
}

export function projectHealthResult(metrics: InformativeMetric[], sla?: SlaSummary): CheckResult {
  const measured = metrics.filter((metric) => metric.value !== null).length;
  return {
    id: PROJECT_HEALTH_CHECK_ID,
    title: "Project health (CHAOSS)",
    description:
      "How active and widely carried the project is: the bus factor, the spread over organisations, how change requests and issues are handled, and how often it releases. Informative: shown, not rated.",
    status: "info",
    message: `${measured} of ${metrics.length} CHAOSS metrics measured. They are shown for information and do not count in any rating.`,
    evidence: [],
    referenceUrl: CHAOSS_METRICS,
    metrics,
    ...(sla ? { sla } : {}),
  };
}

export interface ProjectHealthOptions {
  kpiTargets?: Record<string, KpiTarget>;
  slaTerms?: Record<SlaCategory, SlaTerm>;
  slaLabels?: Record<string, string> | null;
}

/** Measures the light CHAOSS project health set through the forge's REST API. */
export async function checkProjectHealth(
  context: RepoContext,
  meta: RepositoryMeta,
  now: Date = new Date(),
  options: ProjectHealthOptions = {}
): Promise<CheckResult> {
  let activity: ProjectActivity;
  let sla: SlaSummary;
  if (context.provider.id === "github") {
    const fullName = typeof meta.full_name === "string" ? meta.full_name : context.projectPath;
    const hasIssues = meta.has_issues !== false;
    const [githubActivity, slaInput] = await Promise.all([
      fetchGitHubActivity(fullName, now, { hasIssues }),
      hasIssues
        ? fetchGitHubSlaInput(fullName, now)
        : Promise.resolve({ notMeasured: "the repository has its issue tracker switched off" }),
    ]);
    activity = githubActivity;
    sla =
      "notMeasured" in slaInput
        ? slaNotMeasured(slaInput.notMeasured, now)
        : summarizeSla(slaInput, options.slaTerms ?? DEFAULT_SLA_TERMS, effectiveSlaLabels(options.slaLabels), now);
  } else if (context.provider.id === "gitlab") {
    activity = await fetchGitLabActivity(context.projectPath, now);
    sla = slaNotMeasured("issue response and fix times are read from GitHub only", now);
  } else {
    const reason = `the ${context.provider.id} provider has no activity API`;
    const failed = { measured: false as const, reason };
    activity = {
      contributorCommits: failed,
      commitDomains: failed,
      changeRequests: failed,
      changeRequestResponses: failed,
      issueResponses: failed,
      releases: failed,
    };
    sla = slaNotMeasured(reason, now);
  }
  return projectHealthResult(withKpiTargets(projectHealthMetrics(activity, now), options.kpiTargets ?? DEFAULT_KPI_TARGETS), sla);
}
