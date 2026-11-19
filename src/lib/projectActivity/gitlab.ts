import { gitlabHeaders } from "../providers/gitlab";
import {
  RESPONSE_SAMPLE_SIZE,
  activityWindows,
  authorNumbering,
  earliest,
  errorReason,
  isBotName,
  notMeasured,
  type CommitCounts,
  type CommitDomains,
  type Measured,
  type ProjectActivity,
  type Releases,
  type ResponseSet,
} from "./types";

import { canonicalEmail, parseMailmap, resolveOrganisations, type ContributorIdentity } from "../contributorOrganisations";

const BASE = "https://gitlab.com/api/v4";
const REVALIDATE_SECONDS = 3600;
const COMMIT_PAGES = 5;

interface GitLabUser {
  id?: number;
  username?: string;
}

async function glGet(path: string): Promise<{ data: unknown; total: number | null }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: gitlabHeaders(),
    next: { revalidate: REVALIDATE_SECONDS },
  } as RequestInit);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitLab API ${res.status}: ${body.slice(0, 80)}`);
  }
  const total = res.headers.get("x-total");
  return { data: await res.json(), total: total === null || total === "" ? null : Number(total) };
}

async function count(path: string): Promise<number> {
  const { total } = await glGet(`${path}${path.includes("?") ? "&" : "?"}per_page=1`);
  if (total === null || !Number.isFinite(total)) {
    throw new Error("GitLab gives no total for more than 10,000 items");
  }
  return total;
}

async function readMailmap(project: string): Promise<Map<string, string>> {
  try {
    const { data } = await glGet(`/projects/${project}/repository/files/.mailmap?ref=HEAD`);
    const content = (data as { content?: string } | null)?.content;
    return parseMailmap(typeof content === "string" ? Buffer.from(content, "base64").toString("utf-8") : null);
  } catch {
    return new Map();
  }
}

/**
 * Counts the human commits of the last 12 months per author, after the
 * .mailmap, and their organisations. GitLab does not say which account made a
 * commit, so profiles are not looked up.
 */
async function commits(
  project: string,
  since: Date
): Promise<{ counts: Measured<CommitCounts>; domains: Measured<CommitDomains> }> {
  const mailmap = await readMailmap(project);
  const authorNumber = authorNumbering();
  const perAuthor = new Map<number, number>();
  const identities: ContributorIdentity[] = [];
  const sampledAuthors: number[] = [];
  let sampled = 0;
  let complete = false;
  for (let page = 1; page <= COMMIT_PAGES; page += 1) {
    const { data } = await glGet(
      `/projects/${project}/repository/commits?since=${since.toISOString()}&per_page=100&page=${page}`
    );
    const items = (Array.isArray(data) ? data : []) as Array<{ author_email?: string; author_name?: string }>;
    for (const item of items) {
      sampled += 1;
      const email = canonicalEmail(item.author_email, mailmap);
      if (!email || isBotName(item.author_name) || isBotName(email.split("@")[0])) continue;
      const author = authorNumber(email);
      perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
      identities[author] ??= { email, login: null };
      sampledAuthors.push(author);
    }
    if (items.length < 100) {
      complete = true;
      break;
    }
  }
  const resolution = await resolveOrganisations(identities);
  const organisations = sampledAuthors.map((author) => ({ organisation: resolution.contributors[author].organisation, author }));
  const scope = complete ? "the commits of the last 12 months" : `the latest ${sampled} commits of the last 12 months`;
  return {
    counts: { measured: true, value: { counts: [...perAuthor.values()], scope } },
    domains: {
      measured: true,
      value: { commits: organisations, scope, notLookedUp: 0, lookupAvailable: false },
    },
  };
}

async function responses(
  project: string,
  kind: "merge_requests" | "issues",
  from: Date,
  to: Date
): Promise<Measured<ResponseSet>> {
  const { data } = await glGet(
    `/projects/${project}/${kind}?created_after=${from.toISOString()}&created_before=${to.toISOString()}&order_by=created_at&sort=desc&per_page=50`
  );
  const items = (Array.isArray(data) ? data : []) as Array<{ iid: number; created_at: string; author?: GitLabUser }>;
  const sampled = items.filter((item) => !isBotName(item.author?.username)).slice(0, RESPONSE_SAMPLE_SIZE);
  const samples = await Promise.all(
    sampled.map(async (item) => {
      const { data: notes } = await glGet(
        `/projects/${project}/${kind}/${item.iid}/notes?sort=asc&order_by=created_at&per_page=50`
      );
      const dates = ((Array.isArray(notes) ? notes : []) as Array<{ system?: boolean; author?: GitLabUser; created_at?: string }>)
        .filter((note) => !note.system && note.author?.id !== item.author?.id && !isBotName(note.author?.username))
        .map((note) => note.created_at);
      return { createdAt: item.created_at, firstResponseAt: earliest(dates) };
    })
  );
  return {
    measured: true,
    value: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), samples },
  };
}

async function releases(project: string): Promise<Measured<Releases>> {
  const { data } = await glGet(`/projects/${project}/releases?per_page=100`);
  const dates = ((Array.isArray(data) ? data : []) as Array<{ released_at?: string; upcoming_release?: boolean }>).flatMap(
    (release) => (release.released_at && !release.upcoming_release ? [release.released_at] : [])
  );
  if (dates.length === 0) {
    return notMeasured("the project publishes no GitLab releases, and the API gives tags no date");
  }
  return { measured: true, value: { dates: dates.sort().reverse(), prereleases: [], complete: true, source: "GitLab releases" } };
}

async function measure<T>(task: () => Promise<Measured<T>>): Promise<Measured<T>> {
  try {
    return await task();
  } catch (error) {
    return notMeasured(errorReason("GitLab", error));
  }
}

/** Collects the project activity of a GitLab project from the REST API. */
export async function fetchGitLabActivity(projectPath: string, now: Date): Promise<ProjectActivity> {
  const project = encodeURIComponent(projectPath);
  const windows = activityWindows(now);
  const quarter = windows.quarter.toISOString();

  const [commitData, changeRequests, changeRequestResponses, issueResponses, releaseDates] = await Promise.all([
    commits(project, windows.year).catch((error) => {
      const failed = notMeasured(errorReason("GitLab", error));
      return { counts: failed, domains: failed };
    }),
    measure(async () => {
      const mergeRequests = `/projects/${project}/merge_requests`;
      const [opened, merged, closed] = await Promise.all([
        count(`${mergeRequests}?created_after=${quarter}`),
        count(`${mergeRequests}?state=merged&merged_after=${quarter}`),
        // GitLab cannot filter on the closing date; a closed merge request is rarely updated after closing.
        count(`${mergeRequests}?state=closed&updated_after=${quarter}`),
      ]);
      return { measured: true as const, value: { opened, closed: merged + closed } };
    }),
    measure(() => responses(project, "merge_requests", windows.quarter, windows.responseCutoff)),
    measure(() => responses(project, "issues", windows.quarter, windows.responseCutoff)),
    measure(() => releases(project)),
  ]);

  return {
    contributorCommits: commitData.counts,
    commitDomains: commitData.domains,
    changeRequests,
    changeRequestResponses,
    issueResponses,
    releases: releaseDates,
  };
}
