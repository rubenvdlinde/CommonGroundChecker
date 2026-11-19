/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const getRepoHistory = vi.hoisted(() => vi.fn());
const getAdminScoring = vi.hoisted(() => vi.fn());
const getRepositoryUsage = vi.hoisted(() => vi.fn());
const getOrganisations = vi.hoisted(() => vi.fn());
const putRepositoryFollow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({
  getRepoHistory,
  getAdminScoring,
  getRepositoryUsage,
  getOrganisations,
  putRepositoryFollow,
  putRepositoryRetire: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));
const loadBasisset = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/basisset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/basisset")>()),
  loadBasisset,
}));

import RepoHistoryPage from "@/app/components/[owner]/[repo]/page";

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
  afterEach(() => {
    cleanup();
    delete process.env.MIN_USERS;
  });

  it("shows the latest run in full with the repository details, the graph and every run", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({ repository, analyses: [older, latest] });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(screen.getByText("Org Repo")).toBeTruthy();
    expect(screen.getByText("Status: stable")).toBeTruthy();
    expect(screen.getByText("Followed")).toBeTruthy();

    const summary = screen.getByRole("region", { name: "Latest run" });
    expect(within(summary).getByRole("img", { name: "Overall rating 3.4 of 5.5, 3 stars" })).toBeTruthy();
    expect(within(summary).getByText("Suitable for Common Ground")).toBeTruthy();
    expect(within(summary).getByText("71")).toBeTruthy();
    expect(within(summary).getByText("Version: 2.0.0")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "See the latest run" })).toBeNull();

    const graph = screen.getByRole("region", { name: "Rating over time" });
    expect(graph.querySelectorAll("svg a")).toHaveLength(2);
    expect(graph.querySelector("svg a[aria-current='page']")?.getAttribute("href")).toBe("/components/org/repo/new");

    const runs = screen.getByRole("region", { name: "All runs" });
    const runLinks = within(runs).getAllByRole("link");
    expect(runLinks.map((link) => link.getAttribute("href"))).toEqual(["/components/org/repo/new", "/components/org/repo/old"]);
    expect(runLinks[0].getAttribute("aria-current")).toBe("page");
    expect(runLinks[1].getAttribute("aria-current")).toBeNull();
    const counts = within(runs)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell").slice(2, 4).map((cell) => cell.textContent));
    // The older run fails a mandatory criterion and its rating 0.5 is below 2.5
    expect(counts).toEqual([
      ["0", "0"],
      ["2", "0"],
    ]);
    expect(runs.textContent).not.toContain("/100");

    expect(screen.getByText("Follow this repository (admin)")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Criteria results for this run" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run new check" }).getAttribute("href")).toBe("/about#check");
    expect(screen.getByRole("link", { name: "Search another component" }).getAttribute("href")).toBe("/components");
  });

  it("rates a run without a stored rating from its stored results", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({ repository, analyses: [latest, older] });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    const runs = screen.getByRole("region", { name: "All runs" });
    const oldRow = within(runs).getAllByRole("row")[2];
    expect(within(oldRow).getByRole("img", { name: "Overall rating 0.5 of 5.5, 1 star" })).toBeTruthy();
    expect(within(oldRow).getByText("Not yet suitable for Common Ground")).toBeTruthy();

    const table = screen.getByRole("table", { name: /Overall rating per run/ });
    const cells = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell").slice(1).map((cell) => cell.textContent));
    expect(cells).toEqual([
      ["0.5", "Does not pass"],
      ["3.4", "Passes"],
    ]);
  });

  it("shows the open drops with their fix-by date, and no drops card on a backend without drops", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository,
      analyses: [latest, older],
      drops: [
        {
          id: "d1",
          repoId: "repo-id",
          analysisId: "new",
          previousAnalysisId: "old",
          scannedRefKind: "release",
          kind: "verdict",
          subject: "suitable",
          label: "Suitable for Common Ground",
          from: "suitable",
          to: "not suitable",
          detectedAt: "2026-11-11T15:39:33Z",
          fixTermDays: 30,
          fixBy: "2026-12-11T15:39:33Z",
          resolvedAt: null,
          resolvedAnalysisId: null,
          overdue: false,
        },
      ],
    });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    const drops = screen.getByRole("region", { name: "Drops to fix" });
    expect(within(drops).getByText("Suitable for Common Ground")).toBeTruthy();
    expect(within(drops).getByText("Open drop, fix by 11-12-2026 (30 days)")).toBeTruthy();

    cleanup();
    getRepoHistory.mockResolvedValue({ repository, analyses: [latest] });
    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));
    expect(screen.queryByRole("region", { name: "Drops to fix" })).toBeNull();
  }, 15000);

  it("says so when the repository has no saved analyses", async () => {
    getRepoHistory.mockRejectedValue(new Error("not found"));

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "missing" }) }));

    expect(screen.getByText("No saved analyses found for org/missing.")).toBeTruthy();
  });

  it("shows Maintained above Suitable with the reasons, and the users over time", async () => {
    process.env.MIN_USERS = "3";
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository: { id: "repo-id", owner: "org", name: "repo", metadata: { topics: [], stars: 0, forks: 0 } },
      analyses: [
        { id: "b", checkedAt: "2026-11-11T10:00:00Z", score: 71, rating: 3.4, endorsement: { passed: true, reasons: [] }, results: [{ id: "publiccode", status: "pass", requirementLevel: "mandatory", publiccode: { developmentStatus: "beta" } }], declaredUserCount: 1 },
        { id: "a", checkedAt: "2026-11-01T10:00:00Z", score: 70, rating: 3.4, endorsement: { passed: true, reasons: [] }, results: [], declaredUserCount: 0 },
      ],
    });
    getRepositoryUsage.mockResolvedValue({
      declaredUsers: ["A"],
      declaredUserCount: 1,
      slas: [],
    });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    expect(getRepositoryUsage).toHaveBeenCalledWith("repo-id");
    const levels = screen.getByRole("list", { name: "Levels" });
    expect(levels.textContent?.indexOf("Maintained")).toBeLessThan(levels.textContent?.indexOf("Suitable for Common Ground") ?? 0);
    const reasons = screen.getByRole("list", { name: "Why it is not yet Maintained" });
    expect(reasons.textContent).toContain("1 of 3 users declared in publiccode.yml");
    expect(reasons.textContent).toContain("No SLA");
    expect(reasons.textContent).toContain("development status is beta, only a stable component can be Maintained");
    expect(screen.getByText("Users declared in publiccode.yml over time")).toBeTruthy();

    const status = screen.getByRole("region", { name: "Common Ground status" });
    expect(status.querySelector("[data-lifecycle-status]")?.textContent).toBe("Measured");
    expect(within(status).getByRole("list", { name: "What is missing for Suitable for Common Ground" })).toBeTruthy();
    expect(within(status).getByText("The Common Ground basisset could not be read just now.")).toBeTruthy();
    expect(within(status).getByText("Retire this component (admin)")).toBeTruthy();
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
    expect(screen.getByRole("list", { name: "Why it is not yet Maintained" }).textContent).toContain("Not yet suitable");
  });

  it("links the declared users to their organisation pages", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository: { id: "repo-id", owner: "org", name: "repo", metadata: { topics: [], stars: 0, forks: 0 } },
      analyses: [],
    });
    getRepositoryUsage.mockResolvedValue({ declaredUsers: ["Gemeente  Utrecht", "Buren"], declaredUserCount: 2, slas: [] });
    getOrganisations.mockResolvedValue({
      organisations: [{ name: "Gemeente Utrecht", slug: "gemeente-utrecht", componentCount: 1 }],
      nearDuplicates: [],
    });

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "org", repo: "repo" }) }));

    const users = screen.getByRole("list", { name: "Declared users" });
    expect(users.querySelector("a")?.getAttribute("href")).toBe("/users/gemeente-utrecht");
    expect(users.querySelectorAll("a")).toHaveLength(1);
  });
});
