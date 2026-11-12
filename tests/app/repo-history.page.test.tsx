/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const getRepoHistory = vi.hoisted(() => vi.fn());
const getAdminScoring = vi.hoisted(() => vi.fn());
const putRepositoryFollow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getRepoHistory, getAdminScoring, putRepositoryFollow }));

import RepoHistoryPage from "@/app/history/[owner]/[repo]/page";

const repository = {
  id: "repo-id",
  owner: "org",
  name: "repo",
  followed: true,
  checkIntervalHours: 168,
  nextCheckAt: "2026-11-18T15:39:33Z",
  metadata: {
    repoUrl: "https://github.com/org/repo",
    topics: [],
    stars: 3,
    forks: 1,
    license: "EUPL-1.2",
    displayName: "Org Repo",
    shortDescription: "A component",
    developmentStatus: "stable",
    maintainers: ["Org"],
  },
};

const latest = {
  id: "new",
  checkedAt: "2026-11-11T15:39:33Z",
  score: 71,
  version: "2.0.0",
  rating: 3.4,
  categoryRatings: {},
  aspectRatings: {},
  endorsement: { passed: true, reasons: [] },
  results: [{ id: "license", title: "License", status: "pass", message: "EUPL", evidence: [] }],
};

const older = {
  id: "old",
  checkedAt: "2026-11-01T15:39:33Z",
  score: 50,
  version: "1.0.0",
  results: [{ id: "copyrightowner", status: "fail", requirementLevel: "mandatory" }],
};

describe("RepoHistoryPage", () => {
  afterEach(() => cleanup());

  it("shows the latest run in full with the repository details, the graph and every run", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({ repository, analyses: [older, latest] });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(screen.getByText("Org Repo")).toBeTruthy();
    expect(screen.getByText("Status: stable")).toBeTruthy();
    expect(screen.getByText("Followed")).toBeTruthy();

    const summary = screen.getByRole("region", { name: "Latest run" });
    expect(within(summary).getByRole("img", { name: "Overall rating 3.4 of 5" })).toBeTruthy();
    expect(within(summary).getByText("Passes")).toBeTruthy();
    expect(within(summary).getByText("71")).toBeTruthy();
    expect(within(summary).getByText("Version: 2.0.0")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "See the latest run" })).toBeNull();

    const graph = screen.getByRole("region", { name: "Rating over time" });
    expect(graph.querySelectorAll("svg a")).toHaveLength(2);
    expect(graph.querySelector("svg a[aria-current='page']")?.getAttribute("href")).toBe("/history/org/repo/new");

    const runs = screen.getByRole("region", { name: "All runs" });
    const runLinks = within(runs).getAllByRole("link");
    expect(runLinks.map((link) => link.getAttribute("href"))).toEqual(["/history/org/repo/new", "/history/org/repo/old"]);
    expect(runLinks[0].getAttribute("aria-current")).toBe("page");
    expect(runLinks[1].getAttribute("aria-current")).toBeNull();
    const counts = within(runs)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell").slice(2, 4).map((cell) => cell.textContent));
    // The older run fails a mandatory criterion and its rating 1.0 is below 2.5
    expect(counts).toEqual([
      ["0", "0"],
      ["2", "0"],
    ]);
    expect(runs.textContent).not.toContain("/100");

    expect(screen.getByText("Follow this repository (admin)")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Criteria results for this run" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run new check" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Search another repository" }).getAttribute("href")).toBe("/history");
  });

  it("rates a run without a stored rating from its stored results", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({ repository, analyses: [latest, older] });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    const runs = screen.getByRole("region", { name: "All runs" });
    const oldRow = within(runs).getAllByRole("row")[2];
    expect(within(oldRow).getByRole("img", { name: "Overall rating 1.0 of 5" })).toBeTruthy();
    expect(within(oldRow).getByText("Does not pass")).toBeTruthy();

    const table = screen.getByRole("table", { name: /Overall rating per run/ });
    const cells = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell").slice(1).map((cell) => cell.textContent));
    expect(cells).toEqual([
      ["1.0", "Does not pass"],
      ["3.4", "Passes"],
    ]);
  });

  it("says so when the repository has no saved analyses", async () => {
    getRepoHistory.mockRejectedValue(new Error("not found"));

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "missing" }) }));

    expect(screen.getByText("No saved analyses found for org/missing.")).toBeTruthy();
  });
});
