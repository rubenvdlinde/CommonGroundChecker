/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

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

function repositoryWith(name: string, latestAnalysis: RepoSummary["latestAnalysis"]): RepoSummary {
  return {
    id: name,
    owner: "org",
    name,
    repoUrl: `https://github.com/org/${name}`,
    helmChartLocations: [],
    dockerLocations: [],
    apiSpecificationLocations: [],
    documentationLocations: [],
    displayName: null,
    shortDescription: null,
    logoUrl: null,
    developmentStatus: null,
    maintenanceType: null,
    maintainers: [],
    updatedAt: "2026-11-11T15:39:33Z",
    followed: false,
    checkIntervalHours: 168,
    lastCheckedAt: "2026-11-11T15:39:33Z",
    nextCheckAt: "2026-11-18T15:39:33Z",
    analysisCount: 1,
    latestAnalysis,
  };
}

describe("HistoryPageClient ratings", () => {
  afterEach(() => cleanup());

  it("shows the latest overall rating next to the score", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        query=""
        repositories={[
          repositoryWith("rated", { checkedAt: "2026-11-11T15:39:33Z", score: 71, rating: 3.4 }),
          repositoryWith("older", { checkedAt: "2026-11-10T15:39:33Z", score: 50 }),
        ]}
      />
    );

    expect(screen.getAllByRole("img", { name: /^Overall rating/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Overall rating 3.4 of 5" })).toBeTruthy();
    expect(screen.getByText("Latest score: 71")).toBeTruthy();
  });
});

function followRepository(overrides: Record<string, unknown>): RepoSummary {
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

describe("HistoryPageClient follow", () => {
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
          followRepository({
            id: "followed",
            name: "followed-repo",
            followed: true,
            checkIntervalHours: 168,
            nextCheckAt: "2026-11-08T10:00:00.000Z",
          }),
          followRepository({ id: "other", name: "other-repo" }),
        ]}
      />
    );

    expect(screen.getAllByText("Followed")).toHaveLength(1);
    expect(screen.getByText("Followed").closest("a")?.textContent).toContain("followed-repo");
    expect(screen.getAllByText(/Next check:/)).toHaveLength(1);
    expect(screen.getByText(/Next check:/).closest("a")?.textContent).toContain("followed-repo");
  });
});
