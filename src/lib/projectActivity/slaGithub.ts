import { ghGet, ghGraphql, releases as finalReleases } from "./github";
import { DAY_MS, errorReason, isBotName } from "./types";
import type { SlaAdvisory, SlaInput, SlaIssue } from "../sla";

/** Issues read per page, and pages read per state: at most 200 open and 200 recently closed issues. */
const PAGE_SIZE = 50;
const MAX_PAGES = 4;
/** Closed issues count when they were closed in this many days. */
const WINDOW_DAYS = 90;

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const ISSUES_QUERY = `query($owner: String!, $name: String!, $after: String, $states: [IssueState!], $since: DateTime) {
  repository(owner: $owner, name: $name) {
    issues(first: ${PAGE_SIZE}, after: $after, states: $states, filterBy: { since: $since }, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title url createdAt closedAt stateReason authorAssociation
        author { login }
        issueType { name }
        labels(first: 20) { nodes { name } }
        comments(first: 30) { nodes { createdAt authorAssociation author { __typename login } } }
        timelineItems(first: 30, itemTypes: [LABELED_EVENT, CLOSED_EVENT]) {
          nodes {
            __typename
            ... on LabeledEvent { createdAt actor { __typename login } }
            ... on ClosedEvent { closer { __typename ... on PullRequest { mergedAt } ... on Commit { committedDate } } }
          }
        }
      }
    }
  }
}`;

type Actor = { __typename?: string; login?: string } | null;

export interface IssueNode {
  title: string;
  url: string;
  createdAt: string;
  closedAt: string | null;
  stateReason: string | null;
  authorAssociation: string;
  author: Actor;
  issueType: { name: string } | null;
  labels: { nodes: Array<{ name: string }> };
  comments: { nodes: Array<{ createdAt: string; authorAssociation: string; author: Actor }> };
  timelineItems: {
    nodes: Array<{
      __typename: string;
      createdAt?: string;
      actor?: Actor;
      closer?: { __typename: string; mergedAt?: string | null; committedDate?: string } | null;
    }>;
  };
}

interface IssuesData {
  repository: {
    issues: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: IssueNode[] };
  } | null;
}

function isPerson(actor: Actor, authorLogin: string | undefined): boolean {
  return !!actor && actor.__typename !== "Bot" && !isBotName(actor.login) && actor.login !== authorLogin;
}

function earliestTime(dates: string[]): string | null {
  const times = dates.map((date) => Date.parse(date)).filter(Number.isFinite);
  return times.length > 0 ? new Date(Math.min(...times)).toISOString() : null;
}

/**
 * The first response by a maintainer: a comment by the owner, a member or a
 * collaborator, or a label set by someone with triage rights. The author
 * and bots do not count.
 */
export function toSlaIssue(node: IssueNode): SlaIssue {
  const author = node.author?.login;
  const comments = node.comments.nodes
    .filter((comment) => MAINTAINER_ASSOCIATIONS.has(comment.authorAssociation) && isPerson(comment.author, author))
    .map((comment) => comment.createdAt);
  const labelled = node.timelineItems.nodes
    .filter((item) => item.__typename === "LabeledEvent" && item.createdAt && isPerson(item.actor ?? null, author))
    .map((item) => item.createdAt as string);
  const closer = [...node.timelineItems.nodes].reverse().find((item) => item.__typename === "ClosedEvent")?.closer;
  const closingChangeAt =
    closer?.__typename === "PullRequest" ? (closer.mergedAt ?? null) : closer?.__typename === "Commit" ? (closer.committedDate ?? null) : null;
  return {
    title: node.title,
    url: node.url,
    createdAt: node.createdAt,
    reportedByMaintainer: MAINTAINER_ASSOCIATIONS.has(node.authorAssociation),
    closedAt: node.closedAt,
    stateReason: node.closedAt ? node.stateReason : null,
    labels: node.labels.nodes.map((label) => label.name.toLowerCase()),
    issueType: node.issueType?.name ?? null,
    firstResponseAt: earliestTime([...comments, ...labelled]),
    closingChangeAt: node.closedAt ? closingChangeAt : null,
  };
}

async function issuePages(
  owner: string,
  name: string,
  states: string[],
  since: string | null
): Promise<{ nodes: IssueNode[]; complete: boolean }> {
  const nodes: IssueNode[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response: { data?: IssuesData; errors?: Array<{ message?: string }> } = await ghGraphql<IssuesData>(
      ISSUES_QUERY,
      { owner, name, after, states, since }
    );
    if (response.errors?.length) throw new Error(response.errors[0].message ?? "GraphQL error");
    const issues: NonNullable<IssuesData["repository"]>["issues"] | undefined = response.data?.repository?.issues;
    if (!issues) throw new Error("repository not found");
    nodes.push(...issues.nodes);
    if (!issues.pageInfo.hasNextPage) return { nodes, complete: true };
    after = issues.pageInfo.endCursor;
  }
  return { nodes, complete: false };
}

async function publishedAdvisories(fullName: string, since: number): Promise<SlaAdvisory[] | { notMeasured: string }> {
  try {
    const { data } = await ghGet(`/repos/${fullName}/security-advisories?state=published&per_page=100`);
    const advisories = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    return advisories.flatMap((advisory) => {
      const { summary, html_url, severity, created_at, published_at } = advisory;
      if (typeof published_at !== "string" || typeof created_at !== "string" || Date.parse(published_at) < since) return [];
      return [
        {
          title: typeof summary === "string" ? summary : "Security advisory",
          url: typeof html_url === "string" ? html_url : "",
          severity: typeof severity === "string" ? severity : "unknown",
          createdAt: created_at,
          publishedAt: published_at,
        },
      ];
    });
  } catch (error) {
    return { notMeasured: errorReason("GitHub security advisories", error) };
  }
}

/**
 * Reads what the SLA measurement needs from GitHub: the open issues, the
 * issues closed in the last 90 days, the final releases of the last 12
 * months (as release frequency counts them) and the published security
 * advisories. Needs a GITHUB_TOKEN, because GraphQL does.
 */
export async function fetchGitHubSlaInput(fullName: string, now: Date): Promise<SlaInput | { notMeasured: string }> {
  if (!process.env.GITHUB_TOKEN) return { notMeasured: "needs a GITHUB_TOKEN, because the issues are read through GraphQL" };
  const [owner, name] = fullName.split("/");
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  try {
    const [open, closed, releases, advisories] = await Promise.all([
      issuePages(owner, name, ["OPEN"], null),
      issuePages(owner, name, ["CLOSED"], new Date(since).toISOString()),
      finalReleases(fullName, new Date(now.getTime() - 365 * DAY_MS)),
      publishedAdvisories(fullName, since),
    ]);
    const closedInWindow = closed.nodes.filter((node) => node.closedAt !== null && Date.parse(node.closedAt) >= since);
    const notes = [
      `Measured over the open issues and the issues closed in the last ${WINDOW_DAYS} days, in working days (Monday to Friday, Europe/Amsterdam, without Dutch public holidays).`,
    ];
    if (!releases.measured) {
      notes.push(`Stable releases could not be read (${releases.reason}), so no fix is dated by a release.`);
    }
    if (!open.complete || !closed.complete) {
      notes.push(`Only the ${MAX_PAGES * PAGE_SIZE} most recently updated issues of each kind were read.`);
    }
    return {
      from: new Date(since).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      issues: [...open.nodes, ...closedInWindow].map(toSlaIssue),
      releases: releases.measured ? releases.value.dates : [],
      advisories,
      notes,
    };
  } catch (error) {
    return { notMeasured: errorReason("GitHub", error) };
  }
}
