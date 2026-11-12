/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import HistoryPageClient from "@/components/HistoryPageClient";
import type { RepoSummary } from "@/generated/openapi-client";
import { buildHistoryHref, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from "@/lib/historySearch";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const repository = {
  id: "repo-1",
  owner: "open-zaak",
  name: "open-zaak",
  repoUrl: "https://github.com/open-zaak/open-zaak",
  analysisCount: 1,
  latestAnalysis: { checkedAt: "2026-11-01T10:00:00Z", score: 71 },
} as unknown as RepoSummary;

describe("history search URL handling", () => {
  it("trims the search term and takes the first value of a repeated parameter", () => {
    expect(normalizeSearchQuery("  zaak ")).toBe("zaak");
    expect(normalizeSearchQuery(["zaak", "other"])).toBe("zaak");
    expect(normalizeSearchQuery(undefined)).toBe("");
  });

  it("keeps the sort options and adds an encoded q only when set", () => {
    expect(buildHistoryHref({ sort: "date", direction: "desc" })).toBe(
      "/history?sort=date&direction=desc"
    );
    expect(buildHistoryHref({ q: "  ", sort: "score", direction: "asc" })).toBe(
      "/history?sort=score&direction=asc"
    );
    expect(buildHistoryHref({ q: "open zaak&co", sort: "score", direction: "asc" })).toBe(
      "/history?sort=score&direction=asc&q=open+zaak%26co"
    );
  });
});

describe("HistoryPageClient search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders a labelled GET search form that carries the current sort", () => {
    const { container } = render(
      <HistoryPageClient sort="score" direction="asc" query="zaak" repositories={[repository]} />
    );

    const input = screen.getByLabelText("Search repositories") as HTMLInputElement;
    expect(input.name).toBe("q");
    expect(input.value).toBe("zaak");
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/history");
    expect(container.querySelector('input[type="hidden"][name="sort"]')?.getAttribute("value")).toBe("score");
    expect(container.querySelector('input[type="hidden"][name="direction"]')?.getAttribute("value")).toBe("asc");
  });

  it("keeps the search term in the sort links", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="zaak" repositories={[repository]} />);

    expect(screen.getByRole("link", { name: "Score ↓" }).getAttribute("href")).toBe(
      "/history?sort=score&direction=desc&q=zaak"
    );
    expect(screen.getByRole("link", { name: "Rating ↑" }).getAttribute("href")).toBe(
      "/history?sort=rating&direction=asc&q=zaak"
    );
  });

  it("updates the URL with q after the debounce while typing", () => {
    render(<HistoryPageClient sort="score" direction="desc" query="" repositories={[repository]} />);

    const input = screen.getByLabelText("Search repositories");
    fireEvent.change(input, { target: { value: "za" } });
    fireEvent.change(input, { target: { value: "zaak " } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/history?sort=score&direction=desc&q=zaak", { scroll: false });
  });

  it("removes q from the URL when the search is cleared", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="zaak" repositories={[repository]} />);

    fireEvent.change(screen.getByLabelText("Search repositories"), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(replace).toHaveBeenCalledWith("/history?sort=date&direction=desc", { scroll: false });
  });

  it("does not navigate when the term is unchanged", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="zaak" repositories={[repository]} />);

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows an empty state naming the search term when nothing matches", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="nothing" repositories={[]} />);

    expect(screen.getByRole("status").textContent).toBe("No repositories match “nothing”.");
    expect(screen.queryByText("No repositories analyzed yet.")).toBeNull();
  });

  it("keeps the original empty state without a search term", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="" repositories={[]} />);

    expect(screen.getByText("No repositories analyzed yet.")).toBeTruthy();
  });

  it("announces how many repositories match", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="zaak" repositories={[repository]} />);

    expect(screen.getByRole("status").textContent).toBe("1 repository matches “zaak”.");
    expect(screen.getByText("open-zaak/open-zaak")).toBeTruthy();
  });
});

function repositoryWith(overrides: Record<string, unknown>): RepoSummary {
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

  it("marks followed repositories and shows their next check", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        query=""
        repositories={[
          repositoryWith({
            id: "followed",
            name: "followed-repo",
            followed: true,
            checkIntervalHours: 168,
            nextCheckAt: "2026-11-08T10:00:00.000Z",
          }),
          repositoryWith({ id: "other", name: "other-repo" }),
        ]}
      />
    );

    expect(screen.getAllByText("Followed")).toHaveLength(1);
    expect(screen.getByText("Followed").closest("a")?.textContent).toContain("followed-repo");
    expect(screen.getAllByText(/Next check:/)).toHaveLength(1);
    expect(screen.getByText(/Next check:/).closest("a")?.textContent).toContain("followed-repo");
  });

  function renderCard(overrides: Record<string, unknown>) {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        query=""
        repositories={[repositoryWith({ id: "card", name: "card-repo", ...overrides })]}
      />
    );
    return screen.getByRole("link", { name: /card-repo/ });
  }

  function footerOf(card: HTMLElement): string[] {
    const footer = card.lastElementChild as HTMLElement;
    return Array.from(footer.children).map((child) => child.textContent ?? "");
  }

  const checkedAt = "2026-11-11T15:39:33Z";

  it("shows the rating right behind the title and no score", () => {
    const card = renderCard({
      latestAnalysis: { checkedAt, score: 71, rating: 3.4 },
    });

    const title = within(card).getByText("example/card-repo").parentElement as HTMLElement;
    expect(within(title).getByRole("img", { name: "Overall rating 3.4 of 5" })).toBeTruthy();
    expect(within(card).queryByText(/score/i)).toBeNull();
    expect(within(card).queryByText("71")).toBeNull();
  });

  it("shows Passed without counts for a run without warnings", () => {
    const card = renderCard({
      latestAnalysis: {
        checkedAt,
        score: 90,
        rating: 4.2,
        endorsement: { passed: true, reasons: [] },
        issueCounts: { errors: 0, warnings: 0 },
      },
    });

    expect(footerOf(card)).toEqual(["Passed", "Version: unknown"]);
  });

  it("shows the warnings after Passed", () => {
    const card = renderCard({
      latestAnalysis: {
        checkedAt,
        score: 90,
        rating: 4.2,
        endorsement: { passed: true, reasons: [] },
        issueCounts: { errors: 0, warnings: 5 },
      },
    });

    expect(footerOf(card)).toEqual(["Passed", "5 warnings", "Version: unknown"]);
  });

  it("shows Failed, the failures, the warnings, Followed and the version, in that order", () => {
    const card = renderCard({
      followed: true,
      checkIntervalHours: 168,
      nextCheckAt: "2026-11-18T10:00:00.000Z",
      latestAnalysis: {
        checkedAt,
        score: 68,
        rating: 3.4,
        endorsement: { passed: false, reasons: ["a", "b", "c"] },
        issueCounts: { errors: 3, warnings: 5 },
      },
    });

    expect(footerOf(card)).toEqual(["Failed", "3 failures", "5 warnings", "Followed", "Version: unknown"]);
    const title = within(card).getByText("example/card-repo").parentElement as HTMLElement;
    expect(within(title).queryByText("Followed")).toBeNull();
  });

  it("uses the singular for one failure and one warning", () => {
    const card = renderCard({
      latestAnalysis: {
        checkedAt,
        score: 68,
        rating: 2.1,
        endorsement: { passed: false, reasons: ["Overall rating below 2.5"] },
        issueCounts: { errors: 1, warnings: 1 },
      },
    });

    expect(footerOf(card)).toEqual(["Failed", "1 failure", "1 warning", "Version: unknown"]);
  });

  it("counts the endorsement reasons as failures for a run without stored counts", () => {
    const card = renderCard({
      latestAnalysis: {
        checkedAt,
        score: 68,
        rating: 3.4,
        endorsement: { passed: false, reasons: ["Mandatory criterion fails: Helm chart", "Mandatory criterion fails: OWASP"] },
      },
    });

    expect(footerOf(card)).toEqual(["Failed", "2 failures", "Version: unknown"]);
  });

  it("shows no chip and no counts for an older run without an endorsement", () => {
    const card = renderCard({
      latestAnalysis: { checkedAt, score: 50, issueCounts: { errors: 2, warnings: 1 } },
    });

    expect(footerOf(card)).toEqual(["Version: unknown"]);
    expect(within(card).queryByText(/Passed|Failed|failure|warning/)).toBeNull();
  });
});

function summary(overrides: Partial<RepoSummary>): RepoSummary {
  return {
    ...repository,
    version: null,
    latestAnalysis: { checkedAt: "2026-05-06T00:00:00Z", score: 80, version: null },
    ...overrides,
  };
}

function renderCards(repositories: RepoSummary[]) {
  render(<HistoryPageClient sort="date" direction="desc" repositories={repositories} />);
}

describe("HistoryPageClient version chip", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the latest analysis's version before the repository's", () => {
    renderCards([
      summary({
        version: "v1.30.0",
        latestAnalysis: { checkedAt: "2026-05-06T00:00:00Z", score: 80, version: "v1.31.2" },
      }),
    ]);

    expect(screen.getByText("Version: v1.31.2")).toBeTruthy();
    expect(screen.queryByText("Version: v1.30.0")).toBeNull();
  });

  it("falls back to the repository's version", () => {
    renderCards([summary({ version: "v2.1.0" })]);

    expect(screen.getByText("Version: v2.1.0")).toBeTruthy();
  });

  it("shows no version chip when neither version is known", () => {
    renderCards([summary({})]);

    expect(screen.getByText("open-zaak/open-zaak")).toBeTruthy();
    expect(screen.queryByText(/Version:/)).toBeNull();
  });
});
