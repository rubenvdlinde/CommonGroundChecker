/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import HistoryPageClient from "@/components/HistoryPageClient";
import type { RepoSummary } from "@/generated/openapi-client";

function repository(overrides: Record<string, unknown>): RepoSummary {
  return {
    id: "repo-id",
    owner: "example",
    name: "repo",
    repoUrl: "https://github.com/example/repo",
    helmChartLocations: [],
    dockerLocations: [],
    apiSpecificationLocations: [],
    documentationLocations: [],
    updatedAt: "2026-11-01T10:00:00.000Z",
    followed: false,
    checkIntervalHours: null,
    lastCheckedAt: "2026-11-01T10:00:00.000Z",
    nextCheckAt: null,
    analysisCount: 1,
    latestAnalysis: { checkedAt: "2026-11-01T10:00:00.000Z", score: 70 },
    ...overrides,
  } as unknown as RepoSummary;
}

describe("HistoryPageClient", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the latest overall rating next to the score", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        repositories={[
          repository({
            id: "rated",
            name: "rated",
            latestAnalysis: { checkedAt: "2026-11-11T15:39:33Z", score: 71, rating: 3.4 },
          }),
          repository({
            id: "older",
            name: "older",
            latestAnalysis: { checkedAt: "2026-11-10T15:39:33Z", score: 50 },
          }),
        ]}
      />
    );

    expect(screen.getAllByRole("img", { name: /^Overall rating/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Overall rating 3.4 of 5.5, 3 stars" })).toBeTruthy();
    expect(screen.getByText("Latest score: 71")).toBeTruthy();
  });

  it("marks followed repositories and shows their next check", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        repositories={[
          repository({
            id: "followed",
            name: "followed-repo",
            followed: true,
            checkIntervalHours: 168,
            nextCheckAt: "2026-11-08T10:00:00.000Z",
          }),
          repository({ id: "other", name: "other-repo" }),
        ]}
      />
    );

    expect(screen.getAllByText("Followed")).toHaveLength(1);
    expect(screen.getByText("Followed").closest("a")?.textContent).toContain("followed-repo");
    expect(screen.getAllByText(/Next check:/)).toHaveLength(1);
    expect(screen.getByText(/Next check:/).closest("a")?.textContent).toContain("followed-repo");
  });
});
