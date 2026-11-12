/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const getRepoHistory = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getRepoHistory }));

import RepoHistoryPage from "@/app/history/[owner]/[repo]/page";
import AnalysisDetailPage from "@/app/history/[owner]/[repo]/[analysisId]/page";

const history = {
  repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [], stars: 0, forks: 0 } },
  analyses: [{ id: "analysis-1", checkedAt: "2026-11-11T15:39:33Z", score: 71, version: "1.0.0", results: [] }],
};

describe("history pages", () => {
  afterEach(() => cleanup());

  it("leave the site navigation to the header on the repository history page", async () => {
    getRepoHistory.mockResolvedValue(history);
    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(screen.getByRole("heading", { name: "Repository History" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("leave the site navigation to the header on the analysis page", async () => {
    getRepoHistory.mockResolvedValue(history);
    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByRole("heading", { name: "Analysis Details" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });
});
