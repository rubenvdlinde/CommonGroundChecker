import { beforeEach, describe, expect, it, vi } from "vitest";

const runChecks = vi.hoisted(() => vi.fn());
const postRepository = vi.hoisted(() => vi.fn());
const postRepositoryAnalysis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/checkers", () => ({ runChecks }));
vi.mock("@/lib/apiClient", () => ({
  postRepository,
  postRepositoryAnalysis,
  toPubliccodeRepositoryMetadata: () => ({}),
}));

import { POST } from "@/app/api/check/route";
import { POST as POST_STREAM } from "@/app/api/check/stream/route";

function result(id: string, requirementLevel: string, status: string) {
  return { id, title: id, description: id, requirementLevel, status, message: id };
}

const report = {
  repoUrl: "https://github.com/org/repo",
  owner: "org",
  repo: "repo",
  checkedAt: "2026-11-12T10:00:00Z",
  scoringConfigId: null,
  score: 40,
  rating: 2.1,
  categoryRatings: {},
  aspectRatings: {},
  endorsement: {
    passed: false,
    reasons: ["Mandatory criterion fails: license", "Overall rating below 2.5"],
  },
  results: [
    result("license", "mandatory", "fail"),
    result("publiccode", "mandatory", "warn"),
    result("changelog", "recommended", "fail"),
    result("sbom", "recommended", "pass"),
  ],
  repoMeta: {
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    defaultBranch: "main",
    topics: [],
    license: null,
    version: null,
    versionEvidence: { source: "none", detail: "" },
  },
};

function request(url: string) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repoUrl: report.repoUrl }),
  });
}

describe("check routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runChecks.mockResolvedValue(report);
    postRepository.mockResolvedValue({ id: "repo-id" });
    postRepositoryAnalysis.mockResolvedValue({});
  });

  it("sends the error and warning counts with the analysis, counting the rating below 2.5 as an error", async () => {
    const response = await POST(request("http://localhost/api/check"));

    expect(response.status).toBe(200);
    expect(postRepositoryAnalysis).toHaveBeenCalledWith(
      "repo-id",
      expect.objectContaining({ issueCounts: { errors: 2, warnings: 2 } })
    );
  });

  it("sends the same counts from the streaming route", async () => {
    const response = await POST_STREAM(request("http://localhost/api/check/stream"));
    await response.text();

    expect(postRepositoryAnalysis).toHaveBeenCalledWith(
      "repo-id",
      expect.objectContaining({ issueCounts: { errors: 2, warnings: 2 } })
    );
  });
});
