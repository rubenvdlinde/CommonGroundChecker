import { describe, expect, it, vi } from "vitest";
import {
  checkSonarQube,
  declaredProjectKey,
  formatDebtRatio,
  projectKeyCandidates,
  sonarQubeConfigFromEnv,
} from "@/lib/checkers/sonarqube";
import type { RepoContext } from "@/lib/providers/types";

const CONFIG = { url: "https://sonar.example.org", token: "squ_secret" };

function contextWith(files: Record<string, string> = {}): RepoContext {
  return {
    owner: "ConductionNL",
    repo: "openregister",
    projectPath: "ConductionNL/openregister",
    repoUrl: "https://github.com/ConductionNL/openregister",
    provider: {
      id: "github",
      hostname: "github.com",
      parseRepoUrl: () => null,
      getRepoMeta: async () => ({}),
      getRepoTree: async () => [],
      getFileContent: async (_context, path) => files[path] ?? null,
      getRepoVersion: async () => ({ version: null, evidence: { source: "none", detail: "" } }),
      getCloneUrl: () => "",
    },
  };
}

const MEASURES = {
  component: {
    measures: [
      { metric: "sqale_debt_ratio", value: "0.0" },
      { metric: "sqale_index", value: "7626" },
      { metric: "software_quality_maintainability_remediation_effort", value: "6491" },
      { metric: "development_cost", value: "17449680" },
      { metric: "ncloc", value: "581656" },
    ],
  },
};

const RULE_TOTALS: Record<string, number> = { S138: 81, S3776: 19, S107: 25, S1192: 257 };

const ISSUES = {
  total: 382,
  facets: [
    {
      property: "files",
      values: [
        { val: "lib/Service/ObjectService.php", count: 31 },
        { val: "lib/Db/ObjectEntityMapper.php", count: 22 },
      ],
    },
  ],
};

/** A fake SonarQube that knows the given project keys and answers the Web API paths the check reads. */
function fakeSonarQube(projects: string[], overrides: Record<string, () => Response> = {}) {
  return vi.fn(async (input: string, _init?: RequestInit) => {
    const url = new URL(input);
    const override = overrides[url.pathname];
    if (override) return override();
    const component = url.searchParams.get("component") ?? url.searchParams.get("components") ?? url.searchParams.get("project");
    if (url.pathname === "/api/server/version") return new Response("26.10.0.133078");
    if (component && !projects.includes(component)) return new Response("{}", { status: 404 });
    switch (url.pathname) {
      case "/api/components/show":
        return Response.json({ component: { key: component } });
      case "/api/measures/component":
        return Response.json(MEASURES);
      case "/api/issues/search": {
        if (url.searchParams.get("facets")) return Response.json(ISSUES);
        const rule = url.searchParams.get("rules")?.split(",")[0].split(":")[1] ?? "";
        return Response.json({ total: RULE_TOTALS[rule] ?? 0 });
      }
      case "/api/qualityprofiles/search":
        return Response.json({
          profiles: [
            { name: "CGC calibrated", language: "php" },
            { name: "Sonar way core", language: "java" },
            { name: "CGC calibrated", language: "py" },
          ],
        });
      default:
        return new Response("{}", { status: 404 });
    }
  });
}

describe("sonarQubeConfigFromEnv", () => {
  it("needs both the URL and the token", () => {
    expect(sonarQubeConfigFromEnv({ SONARQUBE_URL: "https://sonar.example.org/" })).toBeNull();
    expect(sonarQubeConfigFromEnv({ SONARQUBE_TOKEN: "t" })).toBeNull();
    expect(
      sonarQubeConfigFromEnv({ SONARQUBE_URL: "https://sonar.example.org/", SONARQUBE_TOKEN: " t " })
    ).toEqual({ url: "https://sonar.example.org", token: "t" });
  });
});

describe("project keys", () => {
  it("reads sonar.projectKey from sonar-project.properties", () => {
    expect(declaredProjectKey("# comment\nsonar.organization=x\nsonar.projectKey = my-key \n")).toBe("my-key");
    expect(declaredProjectKey("sonar.projectKey:other")).toBe("other");
    expect(declaredProjectKey("sonar.projectName=x")).toBeUndefined();
  });

  it("tries the declared key, then owner_repo, then the repository name", () => {
    expect(projectKeyCandidates("ConductionNL", "openregister", "declared")).toEqual([
      "declared",
      "ConductionNL_openregister",
      "openregister",
    ]);
    expect(projectKeyCandidates("group/sub", "repo")).toEqual(["group_sub_repo", "repo"]);
  });
});

describe("formatDebtRatio", () => {
  it("keeps two significant digits below 1 %", () => {
    expect(formatDebtRatio(0.0372)).toBe("0.037 %");
    expect(formatDebtRatio(2.345)).toBe("2.3 %");
    expect(formatDebtRatio(0)).toBe("0 %");
  });
});

describe("checkSonarQube", () => {
  it("shows nothing when no SonarQube is configured", async () => {
    const fetchImpl = vi.fn();

    expect(await checkSonarQube(contextWith(), [], null, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows nothing when the SonarQube has no project for the component", async () => {
    expect(await checkSonarQube(contextWith(), [], CONFIG, fakeSonarQube(["something-else"]))).toBeNull();
  });

  it("reads the debt ratio, the rule counts and the worst files as information only", async () => {
    const result = await checkSonarQube(contextWith(), [], CONFIG, fakeSonarQube(["ConductionNL_openregister"]));

    expect(result?.id).toBe("sonarqube");
    expect(result?.title).toBe("External comparison: SonarQube");
    expect(result?.status).toBe("info");
    expect(result?.starRating).toBeUndefined();
    expect(result?.message).toContain("Technical debt ratio 0.037 % over 581,656 lines of code");
    expect(result?.message).toContain("382 open issue(s)");
    expect(result?.evidence).toEqual(
      expect.arrayContaining([
        "S138 function length: 81 open issue(s)",
        "S3776 cognitive complexity: 19 open issue(s)",
        "S107 too many parameters: 25 open issue(s)",
        "S1192 duplicated string literals: 257 open issue(s)",
        "Worst file: lib/Service/ObjectService.php (31 issue(s))",
        "Quality profile: CGC calibrated (php), CGC calibrated (py)",
        "Project key ConductionNL_openregister (derived from the repository URL) on SonarQube 26.10.0.133078",
      ])
    );
    expect(result?.evidence?.at(-1)).toContain("fitted on six repositories");
  });

  it("sends the token only as a bearer header and never puts it or the server URL in the result", async () => {
    const fetchImpl = fakeSonarQube(["ConductionNL_openregister"]);
    const result = await checkSonarQube(contextWith(), [], CONFIG, fetchImpl);

    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url).not.toContain(CONFIG.token);
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${CONFIG.token}`);
    }
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain(CONFIG.token);
    expect(serialised).not.toContain("sonar.example.org");
  });

  it("asks only for the four SIG-like rules in the four languages, open issues only", async () => {
    const fetchImpl = fakeSonarQube(["ConductionNL_openregister"]);
    await checkSonarQube(contextWith(), [], CONFIG, fetchImpl);

    const issueCalls = fetchImpl.mock.calls
      .map(([url]) => new URL(url))
      .filter((url) => url.pathname === "/api/issues/search");
    const combined = issueCalls.find((url) => url.searchParams.get("facets") === "files");
    const rules = combined?.searchParams.get("rules")?.split(",") ?? [];
    expect(rules).toHaveLength(16);
    expect(rules).toContain("php:S138");
    expect(rules).toContain("python:S3776");
    expect(issueCalls.map((url) => url.searchParams.get("rules")?.split(",").length)).toEqual([16, 4, 4, 4, 4]);
    expect(issueCalls.every((url) => url.searchParams.get("issueStatuses") === "OPEN,CONFIRMED")).toBe(true);
  });

  it("prefers the key declared in sonar-project.properties", async () => {
    const context = contextWith({ "sonar-project.properties": "sonar.projectKey=or-main\n" });
    const result = await checkSonarQube(
      context,
      ["sonar-project.properties"],
      CONFIG,
      fakeSonarQube(["or-main", "ConductionNL_openregister"])
    );

    expect(result?.evidence).toContain(
      "Project key or-main (from sonar-project.properties) on SonarQube 26.10.0.133078"
    );
  });

  it("falls back to the bare repository name", async () => {
    const result = await checkSonarQube(contextWith(), [], CONFIG, fakeSonarQube(["openregister"]));

    expect(result?.evidence?.some((line) => line.startsWith("Project key openregister "))).toBe(true);
  });

  it("uses sqale_index when the server reports no Multi-Quality Rule effort", async () => {
    const fetchImpl = fakeSonarQube(["openregister"], {
      "/api/measures/component": () =>
        Response.json({
          component: {
            measures: [
              { metric: "sqale_index", value: "1186" },
              { metric: "development_cost", value: "1671450" },
            ],
          },
        }),
    });
    const result = await checkSonarQube(contextWith(), [], CONFIG, fetchImpl);

    expect(result?.message).toMatch(/^Technical debt ratio 0\.071 %;/);
  });

  it("falls back to sqale_debt_ratio when the debt and cost are not reported", async () => {
    const fetchImpl = fakeSonarQube(["openregister"], {
      "/api/measures/component": () =>
        Response.json({ component: { measures: [{ metric: "sqale_debt_ratio", value: "1.4" }] } }),
    });
    const result = await checkSonarQube(contextWith(), [], CONFIG, fetchImpl);

    expect(result?.message).toMatch(/^Technical debt ratio 1\.4 %;/);
  });

  it("leaves out the profile and version when they cannot be read", async () => {
    const fetchImpl = fakeSonarQube(["openregister"], {
      "/api/qualityprofiles/search": () => new Response("", { status: 403 }),
      "/api/server/version": () => new Response("", { status: 403 }),
    });
    const result = await checkSonarQube(contextWith(), [], CONFIG, fetchImpl);

    expect(result?.evidence?.some((line) => line.startsWith("Quality profile"))).toBe(false);
    expect(result?.evidence).toContain("Project key openregister (derived from the repository URL)");
  });

  it("says the configured SonarQube could not be read on an authentication error", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));
    const result = await checkSonarQube(contextWith(), [], CONFIG, fetchImpl);

    expect(result?.status).toBe("info");
    expect(result?.message).toContain("could not be read");
    expect(result?.evidence).toEqual(["SonarQube returned HTTP 401 for /api/components/show."]);
  });
});
