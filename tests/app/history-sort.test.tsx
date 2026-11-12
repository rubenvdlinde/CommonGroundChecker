/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { RepoSummary } from "@/generated/openapi-client";

const getRepositories = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getRepositories }));

import HistoryHomePage from "@/app/history/page";
import { sortRepositories } from "@/components/HistoryPageClient";

function repository(name: string, score: number, rating: number | null, checkedAt = "2026-11-11T10:00:00Z"): RepoSummary {
  return {
    id: name,
    owner: "org",
    name,
    repoUrl: `https://github.com/org/${name}`,
    helmChartLocations: [],
    dockerLocations: [],
    apiSpecificationLocations: [],
    documentationLocations: [],
    updatedAt: checkedAt,
    analysisCount: 1,
    latestAnalysis: { checkedAt, score, rating },
  } as unknown as RepoSummary;
}

const repositories = [
  repository("low", 90, 2.1, "2026-11-12T10:00:00Z"),
  repository("unrated", 95, null, "2026-11-10T10:00:00Z"),
  repository("high", 60, 4.2, "2026-11-11T10:00:00Z"),
];

describe("history sorting", () => {
  afterEach(() => cleanup());

  it("sorts by rating, highest first, and puts unrated repositories last", () => {
    expect(sortRepositories(repositories, "rating", "desc").map((r) => r.name)).toEqual(["high", "low", "unrated"]);
    expect(sortRepositories(repositories, "rating", "asc").map((r) => r.name)).toEqual(["low", "high", "unrated"]);
  });

  it("still sorts by score and by date", () => {
    expect(sortRepositories(repositories, "score", "desc").map((r) => r.name)).toEqual(["unrated", "low", "high"]);
    expect(sortRepositories(repositories, "date", "desc").map((r) => r.name)).toEqual(["low", "high", "unrated"]);
  });

  it("orders by rating, highest first, when the URL has no sort", async () => {
    getRepositories.mockResolvedValue(repositories);

    render(await HistoryHomePage({ searchParams: Promise.resolve({}) }));

    const names = screen.getAllByText(/^org\/(low|high|unrated)$/).map((element) => element.textContent);
    expect(names).toEqual(["org/high", "org/low", "org/unrated"]);
    expect(screen.getByRole("link", { name: "Rating ↓" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "Date ↓" }).getAttribute("aria-current")).toBeNull();
  });
});
