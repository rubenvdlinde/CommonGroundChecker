/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const getRepoHistory = vi.hoisted(() => vi.fn());
const getAdminScoring = vi.hoisted(() => vi.fn());
const getRepositoryUsage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getRepoHistory, getAdminScoring, getRepositoryUsage }));

import RepoHistoryPage from "@/app/history/[owner]/[repo]/page";

describe("RepoHistoryPage", () => {
  afterEach(() => {
    cleanup();
    delete process.env.MIN_CONFIRMED_USERS;
  });

  it("shows each analysis's overall rating, computed for older analyses", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository: { owner: "org", name: "repo", metadata: { repoUrl: "https://github.com/org/repo", topics: [], stars: 0, forks: 0 } },
      analyses: [
        { id: "new", checkedAt: "2026-11-11T15:39:33Z", score: 71, rating: 3.4, categoryRatings: {}, aspectRatings: {}, endorsement: { passed: true, reasons: [] }, results: [] },
        {
          id: "old",
          checkedAt: "2026-11-01T15:39:33Z",
          score: 50,
          results: [{ id: "copyrightowner", status: "fail", requirementLevel: "mandatory" }],
        },
      ],
    });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(screen.getByRole("img", { name: "Overall rating 3.4 of 5.5, 3 stars" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall rating 0.5 of 5.5, 1 star" })).toBeTruthy();
  });

  it("shows Approved above Suitable with the reasons, and the users over time", async () => {
    process.env.MIN_CONFIRMED_USERS = "3";
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository: { id: "repo-id", owner: "org", name: "repo", metadata: { topics: [], stars: 0, forks: 0 } },
      analyses: [
        { id: "b", checkedAt: "2026-11-11T10:00:00Z", score: 71, rating: 3.4, endorsement: { passed: true, reasons: [] }, results: [{ id: "publiccode", status: "pass", requirementLevel: "mandatory", publiccode: { developmentStatus: "beta" } }], declaredUserCount: 4, confirmedUserCount: 1 },
        { id: "a", checkedAt: "2026-11-01T10:00:00Z", score: 70, rating: 3.4, endorsement: { passed: true, reasons: [] }, results: [], declaredUserCount: 3, confirmedUserCount: 0 },
      ],
    });
    getRepositoryUsage.mockResolvedValue({
      declaredUsers: ["A", "B", "C", "D"],
      declaredUserCount: 4,
      confirmedUserCount: 1,
      confirmations: [],
      slas: [],
    });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(getRepositoryUsage).toHaveBeenCalledWith("repo-id");
    const levels = screen.getByRole("list", { name: "Levels" });
    expect(levels.textContent?.indexOf("Approved")).toBeLessThan(levels.textContent?.indexOf("Suitable for Common Ground") ?? 0);
    const reasons = screen.getByRole("list", { name: "Why it is not approved" });
    expect(reasons.textContent).toContain("1 of 3 confirmed users");
    expect(reasons.textContent).toContain("No SLA");
    expect(reasons.textContent).toContain("development status is beta, only stable components can be approved");
    expect(screen.getByText("Declared and confirmed users over time")).toBeTruthy();
  });

  it("still renders when the usage cannot be loaded", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository: { id: "repo-id", owner: "org", name: "repo", metadata: { topics: [], stars: 0, forks: 0 } },
      analyses: [],
    });
    getRepositoryUsage.mockRejectedValue(new Error("offline"));

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(screen.getByText("Usage could not be loaded from the backend.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Why it is not approved" }).textContent).toContain("Not yet suitable");
  });
});
