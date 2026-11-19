/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const getRepoHistory = vi.hoisted(() => vi.fn());
const getAdminScoring = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getRepoHistory, getAdminScoring }));

import AnalysisDetailPage from "@/app/history/[owner]/[repo]/[analysisId]/page";
import { resolveCategory } from "@/lib/aspects";
import { mapMaintainabilityReport, type MaintainabilityReport } from "@/lib/checkers/maintainability";
import openZaakFixture from "../fixtures/maintainability-report-open-zaak.json";

function result(id: string, status: string, starRating?: number) {
  return { id, title: id, description: `${id} check`, status, message: `${id} ${status}`, evidence: [], starRating };
}

const GOVERNANCE = resolveCategory("Governance") as string;
const MAINTAINABILITY = resolveCategory("Maintainability") as string;

describe("AnalysisDetailPage", () => {
  afterEach(() => cleanup());

  it("shows the publiccode.yml fields stored with the scan", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2026-11-11T15:39:33Z",
          score: 71,
          version: "1.0.0",
          results: [
            {
              ...result("publiccode", "pass"),
              publiccode: { name: "OpenRegister", landingURL: "https://openregister.app", platforms: ["web"] },
            },
          ],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByRole("region", { name: "From publiccode.yml" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "https://openregister.app" })).toBeTruthy();
  });

  it("shows no publiccode.yml section for a scan stored without its fields", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        { id: "analysis-1", checkedAt: "2026-11-11T15:39:33Z", score: 71, results: [result("publiccode", "pass")] },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.queryByRole("region", { name: "From publiccode.yml" })).toBeNull();
  });

  it("shows the usage stored with the scan, without stars", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2026-11-18T09:00:00Z",
          score: 71,
          results: [
            result("license", "pass"),
            {
              ...result("usage", "info"),
              usage: {
                sources: [
                  {
                    id: "dockerhub:org/repo",
                    kind: "containers",
                    source: "Docker Hub",
                    subject: "org/repo",
                    url: "https://hub.docker.com/r/org/repo",
                    measuredAt: "2026-11-18",
                    caveat: "Includes CI pulls.",
                    figures: [{ label: "pulls in total", value: 42 }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    const group = screen.getByRole("group", { name: /Usage and ecosystem/ });
    expect(group.textContent).toContain("42 pulls in total");
    expect(group.querySelector("[role='meter']")).toBeNull();
  });

  it("shows each criterion's stars", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2026-11-11T15:39:33Z",
          score: 71,
          version: "1.0.0",
          results: [result("maintainability", "warn", 2), result("license", "pass")],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByLabelText("2 of 5 stars")).toBeTruthy();
    expect(screen.getByLabelText("5 of 5 stars")).toBeTruthy();
  });

  it("shows the stored overall rating and the rating per category", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2026-11-11T15:39:33Z",
          score: 71,
          rating: 3.4,
          categoryRatings: { [GOVERNANCE]: 4.6, [MAINTAINABILITY]: 2.1 },
          aspectRatings: { licensing: { rating: 4.6 } },
          endorsement: { passed: true, reasons: [] },
          version: "1.0.0",
          results: [result("maintainability", "warn", 2), result("license", "pass")],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByRole("img", { name: "Overall rating 3.4 of 5.5, 3 stars" })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: `${GOVERNANCE} rating 4.6 of 5.5, 5 stars` }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: `${MAINTAINABILITY} rating 2.1 of 5.5, 2 stars` }).length).toBeGreaterThan(0);
    expect(screen.getByText("Compliance score")).toBeTruthy();
    expect(screen.getByText("71")).toBeTruthy();
    expect(screen.getByText("Suitable for Common Ground")).toBeTruthy();
    expect(getAdminScoring).not.toHaveBeenCalled();
  });

  it("rates an older analysis from its stored results", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2026-11-11T15:39:33Z",
          score: 71,
          version: "1.0.0",
          results: [
            { ...result("copyrightowner", "pass"), requirementLevel: "mandatory" },
            { ...result("publiccode", "fail"), requirementLevel: "mandatory" },
          ],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    // Ownership: copyright owner passes (5), publiccode.yml fails (1)
    expect(screen.getByRole("img", { name: "Overall rating 3.0 of 5.5, 3 stars" })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: `${GOVERNANCE} rating 3.0 of 5.5, 3 stars` }).length).toBeGreaterThan(0);
    expect(screen.getByText("Not yet suitable for Common Ground")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Why it is not yet suitable" }).textContent).toContain(
      "Mandatory criterion fails: publiccode"
    );
  });

  it("shows a bar per aspect and the stored measurements with their thresholds", async () => {
    const maintainability = mapMaintainabilityReport(openZaakFixture as unknown as MaintainabilityReport);
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2026-11-11T15:39:33Z",
          score: 71,
          rating: 2.4,
          categoryRatings: { [MAINTAINABILITY]: 2.6 },
          aspectRatings: { testability: { rating: 1.76 }, licensing: { rating: null } },
          endorsement: { passed: false, reasons: ["Overall rating below 2.5"] },
          version: "1.0.0",
          results: [JSON.parse(JSON.stringify(maintainability)), result("license", "info")],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByRole("meter", { name: "Testability 1.8 of 5.5" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Testability" }).getAttribute("href")).toBe("/docs/maintainability#testability");
    const table = screen.getByRole("table", { name: "What Testability is made of" });
    expect(table.textContent).toContain("Python, complexity above 10");
    expect(table.textContent).toContain("≤ 7.5%");
    expect(screen.getByRole("list", { name: "Why it is not yet suitable" }).textContent).toBe("Overall rating below 2.5");
    expect(screen.getByRole("heading", { name: /^1 error: missing mandatory items$/ })).toBeTruthy();
    const ratingError = screen.getByRole("link", { name: "Overall rating 2.4 is below 2.5: go to the overall rating" });
    expect(document.getElementById(ratingError.getAttribute("href")!.slice(1))?.textContent).toContain("Overall rating");
  });

  it("shows the checklist version the analysis was measured against", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        { id: "analysis-1", checkedAt: "2026-11-19T10:00:00Z", score: 71, checklistVersion: "2026.1", results: [] },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByText("Measured against checklist version 2026.1")).toBeTruthy();
  });

  it("says the checklist version is unknown for an older analysis", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [{ id: "analysis-1", checkedAt: "2026-05-06T10:00:00Z", score: 71, results: [] }],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.getByText("Measured against checklist version unknown")).toBeTruthy();
  });

  it("keeps a stored transition: the fail shows as a warning with its date, not as an error", async () => {
    getRepoHistory.mockResolvedValue({
      repository: { metadata: { repoUrl: "https://github.com/org/repo", topics: [] } },
      analyses: [
        {
          id: "analysis-1",
          checkedAt: "2027-02-01T10:00:00Z",
          score: 71,
          checklistVersion: "2026.1",
          rating: 4,
          categoryRatings: {},
          aspectRatings: {},
          endorsement: { passed: true, reasons: [] },
          results: [{ ...result("license", "fail"), requirementLevel: "mandatory", mandatoryFrom: "2027-03-01" }],
        },
      ],
    });

    render(await AnalysisDetailPage({ params: Promise.resolve({ owner: "org", repo: "repo", analysisId: "analysis-1" }) }));

    expect(screen.queryByRole("heading", { name: /missing mandatory items/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /^1 warning: missing or incomplete items$/ })).toBeTruthy();
    expect(screen.getAllByText("Becomes mandatory on 1 March 2027").length).toBe(2);
  });
});
