import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkOpenSsfScorecard,
  lowestChecks,
  scorecardToResult,
  scorecardScoreToStars,
  starsToStatus,
  type ScorecardResponse,
} from "@/lib/checkers/openssfScorecard";
import type { RepoContext } from "@/lib/providers/types";
import fixture from "./fixtures/scorecard-nextcloud-server.json";

const nextcloudServer = fixture as ScorecardResponse;

function contextFor(providerId: string): RepoContext {
  return {
    owner: "nextcloud",
    repo: "server",
    projectPath: "nextcloud/server",
    repoUrl: "https://github.com/nextcloud/server",
    provider: { id: providerId } as RepoContext["provider"],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("scorecardScoreToStars", () => {
  it.each([
    [10, 5],
    [9, 5],
    [8.9, 4],
    [7, 4],
    [6.9, 3],
    [5, 3],
    [4.9, 2],
    [3, 2],
    [2.9, 1],
    [0, 1],
  ])("maps %s to %s stars", (score, stars) => {
    expect(scorecardScoreToStars(score)).toBe(stars);
  });
});

describe("starsToStatus", () => {
  it("passes 4 and 5 stars, warns on 3 and fails below", () => {
    expect(starsToStatus(5)).toBe("pass");
    expect(starsToStatus(4)).toBe("pass");
    expect(starsToStatus(3)).toBe("warn");
    expect(starsToStatus(2)).toBe("fail");
    expect(starsToStatus(1)).toBe("fail");
  });
});

describe("scorecardToResult", () => {
  it("maps the nextcloud/server fixture to a 3-star warning", () => {
    const result = scorecardToResult(nextcloudServer);
    expect(result.id).toBe("openssfscorecard");
    expect(result.status).toBe("warn");
    expect(result.message).toBe("OpenSSF Scorecard 5.6 / 10 (3 of 5 stars).");
    expect(result.starRating).toBe(3);
    expect(result.evidence?.slice(0, 3)).toEqual([
      "Score: 5.6 / 10",
      "Scorecard date: 2026-11-02",
      "Scored commit: b235e2833cc9a625dbf1252aff5beaae3c4361ce",
    ]);
  });

  it("lists up to five lowest-scoring checks and skips not-applicable ones", () => {
    const lines = lowestChecks(nextcloudServer);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(/^[\w-]+: 0 \/ 10 - /);
    expect(lines.some((line) => line.startsWith("Packaging:"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Signed-Releases:"))).toBe(false);
    const scores = lines.map((line) => Number(line.split(": ")[1].split(" / ")[0]));
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it("passes a high score and fails a low score", () => {
    const high = scorecardToResult({ ...nextcloudServer, score: 9.3 });
    expect(high.status).toBe("pass");
    expect(high.starRating).toBe(5);
    expect(scorecardToResult({ ...nextcloudServer, score: 7.2 }).starRating).toBe(4);
    const low = scorecardToResult({ ...nextcloudServer, score: 2.1 });
    expect(low.status).toBe("fail");
    expect(low.starRating).toBe(1);
    expect(low.message).toBe("OpenSSF Scorecard 2.1 / 10 (1 of 5 stars).");
  });

  it("warns without a star rating when the response has no score", () => {
    const result = scorecardToResult({ checks: [] });
    expect(result.status).toBe("warn");
    expect(result.starRating).toBeUndefined();
  });
});

describe("checkOpenSsfScorecard", () => {
  it("returns info for repositories outside GitHub without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkOpenSsfScorecard(contextFor("gitlab"));
    expect(result.status).toBe("info");
    expect(result.message).toBe("Scorecard covers GitHub repositories only.");
    expect(result.starRating).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the project from the Scorecard API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(nextcloudServer), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkOpenSsfScorecard(contextFor("github"));
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.securityscorecards.dev/projects/github.com/nextcloud/server"
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("3 of 5 stars");
  });

  it("returns info with a Scorecard Action hint on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));
    const result = await checkOpenSsfScorecard(contextFor("github"));
    expect(result.status).toBe("info");
    expect(result.message).toContain("This repository is not in the OpenSSF Scorecard dataset");
    expect(result.message).toContain("Scorecard GitHub Action");
  });

  it("warns on other HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 503 })));
    const result = await checkOpenSsfScorecard(contextFor("github"));
    expect(result.status).toBe("warn");
    expect(result.evidence).toEqual(["Scorecard API returned HTTP 503."]);
  });

  it("warns on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const result = await checkOpenSsfScorecard(contextFor("github"));
    expect(result.status).toBe("warn");
    expect(result.evidence).toEqual(["fetch failed"]);
  });

  it("aborts and warns after 10 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
      )
    );
    const pending = checkOpenSsfScorecard(contextFor("github"));
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(result.status).toBe("warn");
    expect(result.evidence?.[0]).toContain("10 seconds");
  });
});
