import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkProjectHealth,
  contributorAbsenceFactor,
  formatDuration,
  organisationShares,
  projectHealthMetrics,
} from "@/lib/checkers/projectHealth";
import { GitHubRepositoryProvider } from "@/lib/providers/github";
import { GitLabRepositoryProvider } from "@/lib/providers/gitlab";
import type { ProjectActivity } from "@/lib/projectActivity/types";
import type { RepoContext } from "@/lib/providers/types";

const NOW = new Date("2026-11-18T12:00:00Z");

function measured<T>(value: T) {
  return { measured: true as const, value };
}

function activity(overrides: Partial<ProjectActivity> = {}): ProjectActivity {
  return {
    contributorCommits: measured({ counts: [60, 30, 10], scope: "the last 12 months" }),
    commitDomains: measured({
      commits: [
        { organisation: "example.org", author: 0 },
        { organisation: "example.org", author: 1 },
        { organisation: "other.nl", author: 2 },
        { organisation: null, author: 3 },
      ],
      scope: "the last 12 months",
      notLookedUp: 0,
      lookupAvailable: true,
    }),
    changeRequests: measured({ opened: 40, closed: 30 }),
    changeRequestResponses: measured({
      from: "2026-08-20",
      to: "2026-11-11",
      samples: [
        { createdAt: "2026-11-01T10:00:00Z", firstResponseAt: "2026-11-01T12:00:00Z" },
        { createdAt: "2026-11-02T10:00:00Z", firstResponseAt: "2026-11-02T16:00:00Z" },
        { createdAt: "2026-11-03T10:00:00Z", firstResponseAt: null },
      ],
    }),
    issueResponses: measured({ from: "2026-08-20", to: "2026-11-11", samples: [] }),
    releases: measured({
      dates: ["2026-10-01T00:00:00Z", "2026-04-01T00:00:00Z", "2025-01-01T00:00:00Z"],
      prereleases: ["2026-10-20T00:00:00Z"],
      complete: true,
      source: "GitHub releases",
    }),
    ...overrides,
  };
}

function metric(metrics: ReturnType<typeof projectHealthMetrics>, id: string) {
  const found = metrics.find((entry) => entry.id === id);
  if (!found) throw new Error(`No metric ${id}`);
  return found;
}

describe("contributorAbsenceFactor", () => {
  it.each([
    [[10], 1],
    [[60, 30, 10], 1],
    [[30, 30, 30, 10], 2],
    [[5, 5, 5, 5, 5, 5], 3],
  ])("is the fewest contributors with half of %j commits", (counts, factor) => {
    expect(contributorAbsenceFactor(counts)).toBe(factor);
  });

  it("is null without commits", () => {
    expect(contributorAbsenceFactor([])).toBeNull();
    expect(contributorAbsenceFactor([0, 0])).toBeNull();
  });
});

describe("organisationShares", () => {
  it("counts organisations apart from authors of unknown organisation", () => {
    expect(
      organisationShares([
        { organisation: "example.org", author: 0 },
        { organisation: "example.org", author: 1 },
        { organisation: "example.org", author: 0 },
        { organisation: "company:studiox", author: 2 },
        { organisation: null, author: 3 },
        { organisation: null, author: 4 },
      ])
    ).toEqual({
      attributed: 4,
      unattributed: 2,
      organisations: 2,
      largestDomain: "example.org",
      largestShare: 0.75,
      largestAuthors: 2,
      authors: 5,
      unknownAuthors: 2,
    });
  });

  it("does not name an organisation that only one author has", () => {
    const shares = organisationShares([
      { organisation: "someone.example", author: 0 },
      { organisation: "someone.example", author: 0 },
    ]);
    expect(shares.largestDomain).toBeNull();
    expect(shares.largestShare).toBe(1);
  });
});

describe("organisational diversity when most organisations are unknown", () => {
  it("is not measured, with the share and the profiles not looked up", () => {
    const metrics = projectHealthMetrics(
      activity({
        commitDomains: measured({
          commits: [
            { organisation: "example.org", author: 0 },
            { organisation: null, author: 1 },
            { organisation: null, author: 2 },
          ],
          scope: "the last 12 months",
          notLookedUp: 1,
          lookupAvailable: true,
        }),
      }),
      NOW
    );

    expect(metric(metrics, "organizational-diversity").value).toBeNull();
    expect(metric(metrics, "organizational-diversity").explanation).toBe(
      "Not measured: organisation unknown for most contributors (2 of 3); 1 not looked up, because a scan looks up at most 200 profiles."
    );
  });

  it("names a profile company only as an organisation of several authors", () => {
    const metrics = projectHealthMetrics(
      activity({
        commitDomains: measured({
          commits: [
            { organisation: "company:studiox", author: 0 },
            { organisation: "company:studiox", author: 1 },
            { organisation: "example.org", author: 2 },
          ],
          scope: "the last 12 months",
          notLookedUp: 0,
          lookupAvailable: true,
        }),
      }),
      NOW
    );

    expect(metric(metrics, "organizational-diversity").explanation).toContain("the profile company studiox (2 authors)");
  });
});

describe("formatDuration", () => {
  it.each([
    [20 * 60000, "20 minutes"],
    [6.5 * 3600000, "6.5 hours"],
    [3.25 * 86400000, "3.3 days"],
  ])("formats %d ms as %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("projectHealthMetrics", () => {
  it("gives the six CHAOSS metrics with their names and links", () => {
    const metrics = projectHealthMetrics(activity(), NOW);

    expect(metrics.map((entry) => entry.name)).toEqual([
      "Contributor Absence Factor",
      "Organizational Diversity",
      "Change Request Closure Ratio",
      "Time to First Response",
      "Issue Response Time",
      "Release Frequency",
    ]);
    for (const entry of metrics) {
      expect(entry.referenceUrl).toMatch(/^https:\/\/chaoss\.community\/kb\/metric-[a-z-]+\/$/);
    }
  });

  it("reports each value with its explanation", () => {
    const metrics = projectHealthMetrics(activity(), NOW);

    expect(metric(metrics, "contributor-absence-factor").value).toBe("1");
    expect(metric(metrics, "contributor-absence-factor").explanation).toContain("among 3 human contributors");
    expect(metric(metrics, "organizational-diversity").value).toBe("2 organisations; largest 67%");
    expect(metric(metrics, "organizational-diversity").explanation).toContain("example.org (2 authors)");
    expect(metric(metrics, "change-request-closure-ratio").value).toBe("0.75");
    expect(metric(metrics, "time-to-first-response").value).toBe("median 4.0 hours");
    expect(metric(metrics, "time-to-first-response").explanation).toContain("2 got a response; 1 had none yet");
    expect(metric(metrics, "release-frequency").value).toBe("2 in 12 months");
    expect(metric(metrics, "release-frequency").explanation).toContain("1 pre-releases were published");
  });

  it("says not measured with the reason where the API gives no data", () => {
    const metrics = projectHealthMetrics(
      activity({
        contributorCommits: { measured: false, reason: "GitHub was still computing the contributor statistics" },
        changeRequests: measured({ opened: 0, closed: 0 }),
      }),
      NOW
    );

    expect(metric(metrics, "contributor-absence-factor")).toMatchObject({
      value: null,
      explanation: "Not measured: GitHub was still computing the contributor statistics.",
    });
    expect(metric(metrics, "change-request-closure-ratio").explanation).toBe(
      "Not measured: no change requests were opened in the last 90 days."
    );
    expect(metric(metrics, "issue-response-time").explanation).toBe(
      "Not measured: no issues were opened by people between 2026-08-20 and 2026-11-11."
    );
  });

  it("says no response when nobody answered, and at least when the releases were read in part", () => {
    const metrics = projectHealthMetrics(
      activity({
        changeRequestResponses: measured({
          from: "2026-08-20",
          to: "2026-11-11",
          samples: [{ createdAt: "2026-11-01T10:00:00Z", firstResponseAt: null }],
        }),
        releases: measured({ dates: ["2026-10-01T00:00:00Z"], prereleases: [], complete: false, source: "GitHub releases" }),
      }),
      NOW
    );

    expect(metric(metrics, "time-to-first-response").value).toBe("no response");
    expect(metric(metrics, "release-frequency").value).toBe("at least 1 in 12 months");
  });

  it("keeps no logins, names or email addresses", () => {
    const text = JSON.stringify(projectHealthMetrics(activity(), NOW));
    expect(text).not.toMatch(/@/);
  });
});

type Route = [pattern: RegExp, body: unknown, init?: { status?: number; headers?: Record<string, string> }];

/** A route body may be a function of the request, for GraphQL calls that share one URL. */
function mockFetch(routes: Route[]) {
  const fetchMock = vi.fn(async (input: string | URL, request?: RequestInit) => {
    const url = String(input);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) return { ok: false, status: 404, text: async () => "not found", json: async () => ({}), headers: new Headers() };
    const [, answer, init] = route;
    const body = typeof answer === "function" ? answer(JSON.parse(String(request?.body ?? "{}"))) : answer;
    const status = init?.status ?? 200;
    return {
      ok: status < 400,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
      headers: new Headers(init?.headers ?? {}),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function githubContext(): RepoContext {
  return {
    owner: "org",
    repo: "repo",
    projectPath: "org/repo",
    provider: GitHubRepositoryProvider,
    repoUrl: "https://github.com/org/repo",
  };
}

interface GraphqlRequest {
  query: string;
  variables: { after?: string | null };
}

interface ReleaseNode {
  isDraft?: boolean;
  isPrerelease?: boolean;
  publishedAt: string | null;
  createdAt?: string;
}

function releasesAnswer(nodes: ReleaseNode[], hasNextPage: boolean, endCursor: string | null = null) {
  return {
    data: {
      repository: {
        releases: {
          pageInfo: { hasNextPage, endCursor },
          nodes: nodes.map((node) => ({ isDraft: false, isPrerelease: false, createdAt: node.publishedAt, ...node })),
        },
      },
    },
  };
}

function graphqlCalls(fetchMock: ReturnType<typeof mockFetch>): GraphqlRequest[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/graphql"))
    .map(([, request]) => JSON.parse(String(request?.body)) as GraphqlRequest);
}

const WEEK = Date.parse("2026-11-08T00:00:00Z") / 1000;
const OLD_WEEK = Date.parse("2024-01-07T00:00:00Z") / 1000;

describe("checkProjectHealth on GitHub", () => {
  const token = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (token === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = token;
  });

  it("measures the six metrics from the REST API and stores no identities", async () => {
    const fetchMock = mockFetch([
      [
        /\/stats\/contributors$/,
        [
          { author: { login: "alice", type: "User" }, weeks: [{ w: WEEK, c: 8 }, { w: OLD_WEEK, c: 100 }] },
          { author: { login: "bob", type: "User" }, weeks: [{ w: WEEK, c: 4 }] },
          { author: { login: "carol", type: "User" }, weeks: [{ w: WEEK, c: 4 }] },
          { author: { login: "dependabot[bot]", type: "Bot" }, weeks: [{ w: WEEK, c: 90 }] },
        ],
      ],
      [
        /\/commits\?since=/,
        [
          { author: { login: "alice", type: "User" }, commit: { author: { email: "alice@gemeente.example", name: "Alice" } } },
          { author: { login: "bob", type: "User" }, commit: { author: { email: "bob@gemeente.example", name: "Bob" } } },
          { author: { login: "carol", type: "User" }, commit: { author: { email: "carol@gmail.com", name: "Carol" } } },
          { author: null, commit: { author: { email: "alice@hotmail.com", name: "Alice" } } },
          { author: { login: "renovate[bot]", type: "Bot" }, commit: { author: { email: "bot@renovate.example", name: "renovate[bot]" } } },
        ],
      ],
      [/\/contents\/\.mailmap$/, { content: Buffer.from("Alice <alice@gemeente.example> <alice@hotmail.com>\n").toString("base64"), encoding: "base64" }],
      [/\/users\/carol$/, { login: "carol", company: "@Other-Org" }],
      [/search\/issues\?q=[^&]*is%3Apr%20created%3A%3E%3D/, { total_count: 20 }],
      [/search\/issues\?q=[^&]*is%3Apr%20closed%3A%3E%3D/, { total_count: 19 }],
      [
        /search\/issues\?q=[^&]*is%3Apr%20created%3A2026/,
        {
          items: [
            { number: 7, created_at: "2026-11-01T10:00:00Z", user: { login: "alice", type: "User" } },
            { number: 8, created_at: "2026-11-01T10:00:00Z", user: { login: "dependabot[bot]", type: "Bot" } },
          ],
        },
      ],
      [/search\/issues\?q=[^&]*is%3Aissue/, { items: [{ number: 9, created_at: "2026-10-01T00:00:00Z", user: { login: "carol", type: "User" } }] }],
      [
        /\/issues\/7\/comments/,
        [
          { user: { login: "alice", type: "User" }, created_at: "2026-11-01T10:30:00Z" },
          { user: { login: "github-actions[bot]", type: "Bot" }, created_at: "2026-11-01T10:31:00Z" },
          { user: { login: "bob", type: "User" }, created_at: "2026-11-01T14:00:00Z" },
        ],
      ],
      [/\/pulls\/7\/reviews/, [{ user: { login: "carol", type: "User" }, submitted_at: "2026-11-01T12:00:00Z" }]],
      [/\/issues\/9\/comments/, []],
      [
        /\/releases\?per_page=100&page=1$/,
        [
          { draft: false, prerelease: true, published_at: "2026-11-10T00:00:00Z" },
          { draft: false, prerelease: false, published_at: "2026-10-01T00:00:00Z" },
          { draft: true, prerelease: false, published_at: null },
          { draft: false, prerelease: false, published_at: "2025-06-01T00:00:00Z" },
        ],
      ],
    ]);

    const result = await checkProjectHealth(githubContext(), { full_name: "Org/Repo", has_issues: true }, NOW);

    expect(result).toMatchObject({ id: "projecthealth", status: "info" });
    expect(result.message).toBe("6 of 6 CHAOSS metrics measured. They are shown for information and do not count in any rating.");
    const values = Object.fromEntries((result.metrics ?? []).map((entry) => [entry.id, entry.value]));
    expect(values).toEqual({
      "contributor-absence-factor": "1",
      "organizational-diversity": "2 organisations; largest 75%",
      "change-request-closure-ratio": "0.95",
      "time-to-first-response": "median 2.0 hours",
      "issue-response-time": "no response",
      "release-frequency": "1 in 12 months",
    });
    expect(JSON.stringify(result)).not.toMatch(/alice|bob|carol|other-?org|@/i);
    const diversity = (result.metrics ?? []).find((entry) => entry.id === "organizational-diversity");
    expect(diversity?.explanation).toContain("gemeente.example (2 authors)");
    expect(diversity?.explanation).toContain("from 0 of 3 authors whose organisation stays unknown");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("repo%3AOrg%2FRepo"))).toBe(true);
  });

  it("dates version tags through GraphQL when the repository has no releases", async () => {
    const fetchMock = mockFetch([
      [/\/releases\?/, []],
      [
        /\/graphql$/,
        (request: GraphqlRequest) => request.query.includes("releases(") ? releasesAnswer([], false) : {
          data: {
            repository: {
              refs: {
                nodes: [
                  { name: "1.31.2", target: { tagger: { date: "2026-11-09T10:21:21+01:00" } } },
                  { name: "1.31.1-perftest", target: { committedDate: "2026-10-23T14:22:22Z" } },
                  { name: "1.31.0", target: { committedDate: "2026-10-13T11:31:23Z" } },
                ],
              },
            },
          },
        },
      ],
    ]);

    const result = await checkProjectHealth(githubContext(), { full_name: "org/repo", has_issues: false }, NOW);
    const release = result.metrics?.find((entry) => entry.id === "release-frequency");

    expect(release?.value).toBe("2 in 12 months");
    expect(release?.explanation).toContain("counted from the version tags");
    expect(result.metrics?.find((entry) => entry.id === "issue-response-time")?.explanation).toBe(
      "Not measured: the repository has its issue tracker switched off."
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/graphql"))).toBe(true);
  });

  it("skips the calls per sampled item without a token, and retries statistics GitHub is still computing", async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = mockFetch([[/\/stats\/contributors$/, {}, { status: 202 }]]);

    const result = await checkProjectHealth(githubContext(), {}, NOW);
    const byId = Object.fromEntries((result.metrics ?? []).map((entry) => [entry.id, entry.explanation]));

    expect(byId["contributor-absence-factor"]).toBe(
      "Not measured: GitHub was still computing the contributor statistics; run the check again in a minute."
    );
    expect(byId["time-to-first-response"]).toMatch(/^Not measured: needs a GITHUB_TOKEN/);
    expect(byId["organizational-diversity"]).toMatch(/^Not measured: the GitHub API answered with an error \(GitHub API 404/);
    expect(byId["release-frequency"]).toMatch(/^Not measured: the GitHub API answered with an error/);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/stats/contributors"))).toHaveLength(3);
    expect(fetchMock.mock.calls.some(([url]) => /\/comments|\/reviews/.test(String(url)))).toBe(false);
  }, 15000);
});

describe("release frequency on GitHub", () => {
  const token = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (token === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = token;
  });

  async function releaseMetric() {
    const result = await checkProjectHealth(githubContext(), { full_name: "org/repo", has_issues: false }, NOW);
    return result.metrics?.find((entry) => entry.id === "release-frequency");
  }

  it("pages through GraphQL with the cursor and leaves out drafts and pre-releases", async () => {
    const fetchMock = mockFetch([
      [
        /\/graphql$/,
        (request: GraphqlRequest) =>
          request.variables.after === "page-2"
            ? releasesAnswer([{ publishedAt: "2026-03-01T00:00:00Z" }, { publishedAt: "2025-06-01T00:00:00Z" }], false)
            : releasesAnswer(
                [
                  { isDraft: true, publishedAt: null, createdAt: "2026-11-15T00:00:00Z" },
                  { isPrerelease: true, publishedAt: "2026-11-10T00:00:00Z" },
                  { publishedAt: "2026-10-01T00:00:00Z" },
                ],
                true,
                "page-2"
              ),
      ],
    ]);

    const release = await releaseMetric();

    expect(release?.value).toBe("2 in 12 months");
    expect(release?.explanation).toContain("about one every 183 days, counted from the GitHub releases");
    expect(release?.explanation).toContain("Besides these, 1 pre-releases were published");
    expect(graphqlCalls(fetchMock).map((request) => request.variables.after)).toEqual([null, "page-2"]);
    expect(graphqlCalls(fetchMock)[0].query).not.toMatch(/releaseAssets|description/);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/releases?"))).toBe(false);
  });

  it("stops at 20 pages and reports a lower bound", async () => {
    let page = 0;
    const fetchMock = mockFetch([
      [
        /\/graphql$/,
        () => {
          page += 1;
          return releasesAnswer([{ publishedAt: "2026-10-01T00:00:00Z" }], true, `page-${page + 1}`);
        },
      ],
    ]);

    const release = await releaseMetric();

    expect(release?.value).toBe("at least 20 in 12 months");
    expect(release?.explanation).toContain("so the count is a lower bound");
    expect(graphqlCalls(fetchMock)).toHaveLength(20);
  });

  it("falls back to REST when GraphQL answers with an error", async () => {
    const fetchMock = mockFetch([
      [/\/graphql$/, { errors: [{ message: "Something went wrong" }] }],
      [/\/releases\?per_page=100&page=1$/, [{ draft: false, prerelease: false, published_at: "2026-10-01T00:00:00Z" }]],
    ]);

    const release = await releaseMetric();

    expect(release?.value).toBe("1 in 12 months");
    expect(graphqlCalls(fetchMock)).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/releases?per_page=100&page=1"))).toBe(true);
  });

  it("reads REST without a token, as GraphQL needs one", async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = mockFetch([
      [/\/releases\?per_page=100&page=1$/, [{ draft: false, prerelease: false, published_at: "2026-10-01T00:00:00Z" }]],
    ]);

    const release = await releaseMetric();

    expect(release?.value).toBe("1 in 12 months");
    expect(graphqlCalls(fetchMock)).toHaveLength(0);
  });
});

describe("checkProjectHealth on GitLab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("measures the metrics from the GitLab REST API", async () => {
    mockFetch([
      [
        /repository\/commits\?/,
        [
          { author_email: "a@gemeente.example", author_name: "A" },
          { author_email: "a@gemeente.example", author_name: "A" },
          { author_email: "b@gemeente.example", author_name: "B" },
          { author_email: "project_12_bot@noreply.gitlab.example", author_name: "Bot" },
        ],
      ],
      [/merge_requests\?created_after=[^&]*&per_page=1$/, [], { headers: { "x-total": "10" } }],
      [/merge_requests\?state=merged/, [], { headers: { "x-total": "6" } }],
      [/merge_requests\?state=closed/, [], { headers: { "x-total": "2" } }],
      [
        /merge_requests\?created_after=.*created_before/,
        [{ iid: 3, created_at: "2026-11-01T10:00:00Z", author: { id: 1, username: "a" } }],
      ],
      [
        /merge_requests\/3\/notes/,
        [
          { system: true, author: { id: 2, username: "b" }, created_at: "2026-11-01T10:05:00Z" },
          { system: false, author: { id: 2, username: "b" }, created_at: "2026-11-01T11:00:00Z" },
        ],
      ],
      [/issues\?created_after=/, []],
      [/releases\?/, [{ released_at: "2026-09-01T00:00:00Z" }, { released_at: "2027-01-01T00:00:00Z", upcoming_release: true }]],
    ]);

    const result = await checkProjectHealth(
      {
        owner: "group",
        repo: "project",
        projectPath: "group/project",
        provider: GitLabRepositoryProvider,
        repoUrl: "https://gitlab.com/group/project",
      },
      {},
      NOW
    );
    const values = Object.fromEntries((result.metrics ?? []).map((entry) => [entry.id, entry.value]));

    expect(values).toEqual({
      "contributor-absence-factor": "1",
      "organizational-diversity": "1 organisation; largest 100%",
      "change-request-closure-ratio": "0.80",
      "time-to-first-response": "median 1.0 hours",
      "issue-response-time": null,
      "release-frequency": "1 in 12 months",
    });
    expect(JSON.stringify(result)).not.toMatch(/@/);
  });
});

describe("SLA times and KPI targets on GitHub", () => {
  const token = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (token === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = token;
  });

  const openBug = {
    title: "Login fails",
    url: "https://github.com/org/repo/issues/3",
    createdAt: "2026-11-02T09:00:00Z",
    closedAt: null,
    stateReason: null,
    author: { login: "reporter" },
    issueType: null,
    labels: { nodes: [{ name: "Bug" }] },
    comments: {
      nodes: [
        { createdAt: "2026-11-02T10:00:00Z", authorAssociation: "NONE", author: { __typename: "User", login: "someone" } },
        { createdAt: "2026-11-03T09:00:00Z", authorAssociation: "MEMBER", author: { __typename: "User", login: "maintainer" } },
      ],
    },
    timelineItems: { nodes: [] },
  };

  it("measures the issues against the SLA terms with the repository's labels, and adds the KPI targets", async () => {
    const fetchMock = mockFetch([
      [
        /\/graphql$/,
        (request: GraphqlRequest & { variables: { states?: string[] } }) => {
          if (request.query.includes("issues(")) {
            const nodes = request.variables.states?.[0] === "OPEN" ? [{ ...openBug, labels: { nodes: [{ name: "P0" }] } }] : [];
            return { data: { repository: { issues: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } };
          }
          return releasesAnswer([], false);
        },
      ],
      [/\/security-advisories\?state=published/, []],
    ]);

    const result = await checkProjectHealth(githubContext(), { full_name: "org/repo", has_issues: true }, NOW, {
      kpiTargets: { "release-frequency": { min: 4 } },
      slaLabels: { p0: "blocking-bug" },
    });

    expect(result.sla?.notMeasured).toBeNull();
    expect(result.sla?.categories).toEqual([
      expect.objectContaining({
        category: "blocking-bug",
        count: 1,
        response: { measured: 1, median: 1, worst: 1, breaches: 0, waiting: 0 },
      }),
    ]);
    expect(result.sla?.openBreaches).toEqual([
      expect.objectContaining({ title: "Login fails", kind: "fix", due: "2026-11-16T09:00:00.000Z" }),
    ]);
    const graphqlQueries = graphqlCalls(fetchMock).map((call) => call.query);
    expect(graphqlQueries.filter((query) => query.includes("issues("))).toHaveLength(2);
    const release = result.metrics?.find((entry) => entry.id === "release-frequency");
    expect(release?.target?.text).toBe("at least 4 releases in 12 months");
    expect(result.metrics?.find((entry) => entry.id === "contributor-absence-factor")?.target).toBeUndefined();
  });

  it("says the SLA times are not measured without a token", async () => {
    delete process.env.GITHUB_TOKEN;
    mockFetch([]);

    const result = await checkProjectHealth(githubContext(), { full_name: "org/repo", has_issues: true }, NOW);

    expect(result.sla?.notMeasured).toBe("needs a GITHUB_TOKEN, because the issues are read through GraphQL");
    expect(result.metrics?.find((entry) => entry.id === "release-frequency")?.target).toEqual({
      text: "at least 4 releases in 12 months",
      met: null,
    });
  });
});
