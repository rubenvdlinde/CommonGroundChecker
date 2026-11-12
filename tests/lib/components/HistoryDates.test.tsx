/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import HistoryPageClient from "@/components/HistoryPageClient";
import RepoHistoryPage from "@/app/history/[owner]/[repo]/page";
import AnalysisPage from "@/app/history/[owner]/[repo]/[analysisId]/page";
import { getRepoHistory } from "@/lib/apiClient";
import type { RepoSummary } from "@/generated/openapi-client";

vi.mock("@/lib/apiClient", () => ({
  getRepoHistory: vi.fn(),
}));

const checkedAt = "2026-01-15T09:05:44Z";
const shown = "15-1-2026, 10:05:44";

const repository = {
  id: "repo-1",
  owner: "open-zaak",
  name: "open-zaak",
  repoUrl: "https://github.com/open-zaak/open-zaak",
  metadata: {
    description: null,
    language: null,
    stars: 1234,
    forks: 56,
    defaultBranch: "main",
    topics: [],
    license: null,
    version: null,
  },
};

const analysis = {
  id: "analysis-1",
  checkedAt,
  score: 80,
  version: null,
  results: [],
};

afterEach(() => {
  cleanup();
});

describe("history dates", () => {
  it("shows the latest run time on the history card in Amsterdam time", () => {
    const summary = {
      id: "repo-1",
      owner: "open-zaak",
      name: "open-zaak",
      repoUrl: "https://github.com/open-zaak/open-zaak",
      helmChartLocations: [],
      dockerLocations: [],
      apiSpecificationLocations: [],
      documentationLocations: [],
      updatedAt: checkedAt,
      analysisCount: 1,
      latestAnalysis: { checkedAt, score: 80 },
    } satisfies RepoSummary;

    render(<HistoryPageClient sort="date" direction="desc" repositories={[summary]} />);

    expect(screen.getByText(`Last: ${shown}`)).toBeTruthy();
  });

  it("shows the same time on the repository history page", async () => {
    vi.mocked(getRepoHistory).mockResolvedValue({ repository, analyses: [analysis] } as never);

    render(await RepoHistoryPage({ params: Promise.resolve({ owner: "open-zaak", repo: "open-zaak" }) }));

    expect(screen.getByText(shown)).toBeTruthy();
    expect(screen.getByText(/1\.234 stars/)).toBeTruthy();
  });

  it("shows the same time on the analysis page", async () => {
    vi.mocked(getRepoHistory).mockResolvedValue({ repository, analyses: [analysis] } as never);

    render(
      await AnalysisPage({
        params: Promise.resolve({ owner: "open-zaak", repo: "open-zaak", analysisId: "analysis-1" }),
      })
    );

    expect(screen.getByText(`Checked at ${shown}`)).toBeTruthy();
  });
});
