import type { RepoContext } from "../providers/types";
import type { CheckResult, CheckStatus } from "../types";

const CHECK_ID = "openssfscorecard";
const TITLE = "OpenSSF Scorecard";
const DESCRIPTION =
  "Reads the repository's OpenSSF Scorecard (0 to 10) from the public Scorecard API and rates it from 1 to 5 stars. The star bands are this checker's own: 9 or higher is 5 stars, 7 or higher is 4, 5 or higher is 3, 3 or higher is 2, lower is 1. 4 or 5 stars pass, 3 warns, fewer fail.";
const REFERENCE_URL = "https://scorecard.dev";
const API_BASE = "https://api.securityscorecards.dev/projects";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_LOWEST_CHECKS = 5;

/** The part of a Scorecard API project response this check reads. */
export interface ScorecardResponse {
  date?: string;
  repo?: { name?: string; commit?: string };
  scorecard?: { version?: string; commit?: string };
  score?: number;
  checks?: Array<{ name?: string; score?: number; reason?: string }>;
}

/** Maps a 0-10 Scorecard score to 1-5 stars using this checker's own bands. */
export function scoreToStars(score: number): number {
  if (score >= 9) return 5;
  if (score >= 7) return 4;
  if (score >= 5) return 3;
  if (score >= 3) return 2;
  return 1;
}

export function starsToStatus(stars: number): CheckStatus {
  if (stars >= 4) return "pass";
  if (stars === 3) return "warn";
  return "fail";
}

function result(status: CheckStatus, message: string, evidence: string[]): CheckResult {
  return {
    id: CHECK_ID,
    title: TITLE,
    description: DESCRIPTION,
    status,
    message,
    evidence,
    referenceUrl: REFERENCE_URL,
  };
}

/** Lists the lowest-scoring applicable checks; a score of -1 means "not applicable" and is skipped. */
export function lowestChecks(data: ScorecardResponse, limit = MAX_LOWEST_CHECKS): string[] {
  return (data.checks ?? [])
    .filter((check) => typeof check.score === "number" && check.score >= 0)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, limit)
    .map((check) => `${check.name ?? "Unknown check"}: ${check.score} / 10 - ${check.reason ?? "no reason given"}`);
}

/** Maps a Scorecard API response to a check result. */
export function scorecardToResult(data: ScorecardResponse): CheckResult {
  if (typeof data.score !== "number" || !Number.isFinite(data.score)) {
    return result("warn", "The OpenSSF Scorecard response did not contain a score.", []);
  }

  const stars = scoreToStars(data.score);
  const evidence = [`Score: ${data.score} / 10`];
  if (data.date) evidence.push(`Scorecard date: ${data.date}`);
  if (data.repo?.commit) evidence.push(`Scored commit: ${data.repo.commit}`);
  evidence.push(...lowestChecks(data));

  return result(
    starsToStatus(stars),
    `OpenSSF Scorecard ${data.score} / 10 (${stars} of 5 stars).`,
    evidence
  );
}

export function notGitHubResult(): CheckResult {
  return result("info", "Scorecard covers GitHub repositories only.", []);
}

export function notInDatasetResult(): CheckResult {
  return result(
    "info",
    "This repository is not in the OpenSSF Scorecard dataset. The project can publish a score by running the OpenSSF Scorecard GitHub Action (ossf/scorecard-action).",
    ["https://github.com/ossf/scorecard-action"]
  );
}

export function unavailableResult(detail: string): CheckResult {
  return result("warn", "The OpenSSF Scorecard could not be retrieved.", [detail]);
}

/** Fetches the repository's OpenSSF Scorecard and rates it. */
export async function checkOpenSsfScorecard(context: RepoContext): Promise<CheckResult> {
  if (context.provider.id !== "github") {
    return notGitHubResult();
  }

  const url = `${API_BASE}/github.com/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return notInDatasetResult();
    }

    if (!response.ok) {
      return unavailableResult(`Scorecard API returned HTTP ${response.status}.`);
    }

    return scorecardToResult((await response.json()) as ScorecardResponse);
  } catch (error) {
    if (controller.signal.aborted) {
      return unavailableResult(`Scorecard API did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds.`);
    }
    return unavailableResult(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}
