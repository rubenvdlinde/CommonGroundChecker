import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runChecks: vi.fn(),
  postRepository: vi.fn(),
  postRepositoryAnalysis: vi.fn(),
}));

vi.mock("@/lib/checkers", () => ({ runChecks: mocks.runChecks }));
vi.mock("@/lib/apiClient", () => ({
  postRepository: mocks.postRepository,
  postRepositoryAnalysis: mocks.postRepositoryAnalysis,
  toPubliccodeRepositoryMetadata: () => ({}),
}));

import { POST } from "@/app/api/check/route";
import { POST as POST_STREAM } from "@/app/api/check/stream/route";
import { ScanRefError } from "@/lib/scanRef";

const SHA = "0123456789abcdef0123456789abcdef01234567";

function report() {
  return {
    repoUrl: "https://github.com/org/repo",
    owner: "org",
    repo: "repo",
    checkedAt: "2026-11-18T10:00:00.000Z",
    scoringConfigId: null,
    score: 80,
    rating: null,
    categoryRatings: {},
    aspectRatings: {},
    endorsement: { passed: true, reasons: [] },
    results: [],
    scannedRef: "development",
    scannedRefKind: "branch",
    scannedCommit: SHA,
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
}

function request(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/check with a ref", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runChecks.mockResolvedValue(report());
    mocks.postRepository.mockResolvedValue({ id: "repo-id" });
    mocks.postRepositoryAnalysis.mockResolvedValue({});
  });

  it("scans the requested ref and stores which ref and commit were scanned", async () => {
    const response = await POST(
      request("http://localhost/api/check", { repoUrl: "https://github.com/org/repo", ref: " development " })
    );

    expect(response.status).toBe(200);
    expect(mocks.runChecks.mock.calls[0][1]).toMatchObject({ ref: "development" });
    expect(mocks.postRepositoryAnalysis.mock.calls[0][1]).toMatchObject({
      scannedRef: "development",
      scannedRefKind: "branch",
      scannedCommit: SHA,
    });
  });

  it("scans the default branch without a ref", async () => {
    await POST(request("http://localhost/api/check", { repoUrl: "https://github.com/org/repo" }));

    expect(mocks.runChecks.mock.calls[0][1]).toMatchObject({ ref: null });
  });

  it("answers 400 for an invalid ref without scanning", async () => {
    const response = await POST(
      request("http://localhost/api/check", { repoUrl: "https://github.com/org/repo", ref: "a..b" })
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain("Invalid ref");
    expect(mocks.runChecks).not.toHaveBeenCalled();
  });

  it("answers 400 when the branch or tag does not exist", async () => {
    mocks.runChecks.mockRejectedValue(
      new ScanRefError('Branch or tag "nope" was not found in org/repo.')
    );

    const response = await POST(
      request("http://localhost/api/check", { repoUrl: "https://github.com/org/repo", ref: "nope" })
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe(
      'Branch or tag "nope" was not found in org/repo.'
    );
  });

  it("passes the ref through the streaming route and stores the scanned commit", async () => {
    const response = await POST_STREAM(
      request("http://localhost/api/check/stream", {
        repoUrl: "https://github.com/org/repo",
        ref: "latest-release",
      })
    );
    await response.text();

    expect(mocks.runChecks.mock.calls[0][1]).toMatchObject({ ref: "latest-release" });
    expect(mocks.postRepositoryAnalysis.mock.calls[0][1]).toMatchObject({
      scannedRef: "development",
      scannedCommit: SHA,
    });
  });

  it("reports an invalid ref on the streaming route without scanning", async () => {
    const response = await POST_STREAM(
      request("http://localhost/api/check/stream", { repoUrl: "https://github.com/org/repo", ref: "a b" })
    );

    expect(await response.text()).toContain("Invalid ref");
    expect(mocks.runChecks).not.toHaveBeenCalled();
  });
});
