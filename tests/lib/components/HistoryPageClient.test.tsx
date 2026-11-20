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
      "/components?sort=date&direction=desc"
    );
    expect(buildHistoryHref({ q: "  ", sort: "score", direction: "asc" })).toBe(
      "/components?sort=score&direction=asc"
    );
    expect(buildHistoryHref({ q: "open zaak&co", sort: "score", direction: "asc" })).toBe(
      "/components?sort=score&direction=asc&q=open+zaak%26co"
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

    const input = screen.getByLabelText("Search components") as HTMLInputElement;
    expect(input.name).toBe("q");
    expect(input.value).toBe("zaak");
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/components");
    expect(container.querySelector('input[type="hidden"][name="sort"]')?.getAttribute("value")).toBe("score");
    expect(container.querySelector('input[type="hidden"][name="direction"]')?.getAttribute("value")).toBe("asc");
  });

  it("gives the search field and button a touch target of at least 44px below 1024px", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="" repositories={[repository]} />);

    for (const target of [screen.getByLabelText("Search components"), screen.getByRole("button", { name: "Search" })]) {
      expect(target.className).toContain("min-h-[44px]");
      expect(target.className).toContain("lg:min-h-0");
    }
  });

  it("keeps the search term in the sort links", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="zaak" repositories={[repository]} />);

    expect(screen.getByRole("link", { name: "Score ↓" }).getAttribute("href")).toBe(
      "/components?sort=score&direction=desc&q=zaak"
    );
    expect(screen.getByRole("link", { name: "Rating ↑" }).getAttribute("href")).toBe(
      "/components?sort=rating&direction=asc&q=zaak"
    );
  });

  it("updates the URL with q after the debounce while typing", () => {
    render(<HistoryPageClient sort="score" direction="desc" query="" repositories={[repository]} />);

    const input = screen.getByLabelText("Search components");
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
    expect(replace).toHaveBeenCalledWith("/components?sort=score&direction=desc&q=zaak", { scroll: false });
  });

  it("removes q from the URL when the search is cleared", () => {
    render(<HistoryPageClient sort="date" direction="desc" query="zaak" repositories={[repository]} />);

    fireEvent.change(screen.getByLabelText("Search components"), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(replace).toHaveBeenCalledWith("/components?sort=date&direction=desc", { scroll: false });
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
    expect(within(title).getByRole("img", { name: "Overall rating 3.4 of 5.5, 3 stars" })).toBeTruthy();
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

    expect(footerOf(card)).toEqual(["Suitable", "Version: unknown"]);
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

    expect(footerOf(card)).toEqual(["Suitable", "5 warnings", "Version: unknown"]);
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

    expect(footerOf(card)).toEqual(["Not yet suitable", "3 failures", "5 warnings", "Followed", "Version: unknown"]);
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

    expect(footerOf(card)).toEqual(["Not yet suitable", "1 failure", "1 warning", "Version: unknown"]);
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

    expect(footerOf(card)).toEqual(["Not yet suitable", "2 failures", "Version: unknown"]);
  });

  it("shows no chip and no counts for an older run without an endorsement", () => {
    const card = renderCard({
      latestAnalysis: { checkedAt, score: 50, issueCounts: { errors: 2, warnings: 1 } },
    });

    expect(footerOf(card)).toEqual(["Version: unknown"]);
    expect(within(card).queryByText(/suitable|failure|warning/i)).toBeNull();
  });

  it("shows the open and overdue drops on a repository's card", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        query=""
        repositories={[
          repositoryWith({ id: "late", name: "late", openDropCount: 2, overdueDropCount: 1 }),
          repositoryWith({ id: "open", name: "open", openDropCount: 1, overdueDropCount: 0 }),
          repositoryWith({ id: "fine", name: "fine", openDropCount: 0, overdueDropCount: 0 }),
        ]}
      />
    );

    expect(screen.getByText("2 open drops, 1 overdue")).toBeTruthy();
    expect(screen.getByText("1 open drop")).toBeTruthy();
    expect(screen.queryAllByText(/open drop/)).toHaveLength(2);
  });
});

describe("HistoryPageClient status filter", () => {
  afterEach(() => cleanup());

  const basisset = {
    version: "0.3.1",
    components: [
      {
        name: "OpenZaak",
        repo: ["https://github.com/open-zaak/open-zaak"],
        version: "1.29.0",
        description: "",
        status: "g",
        architectureLayers: "1-2",
        basisset: true,
        note: null,
      },
    ],
  };
  const sla = { id: "s", party: "VNG", maintainer: "Maykin", startsOn: "2026-01-01", until: "2027-12-31", link: null };
  const maintained = repositoryWith({
    id: "oz",
    owner: "open-zaak",
    name: "open-zaak",
    repoUrl: "https://github.com/open-zaak/open-zaak",
    slas: [sla],
    latestAnalysis: {
      checkedAt: "2026-11-01T10:00:00.000Z",
      score: 80,
      endorsement: { passed: true, reasons: [] },
      developmentStatus: "stable",
      declaredUserCount: 3,
      version: "1.31.2",
    },
  });
  const measured = repositoryWith({
    id: "m",
    name: "measured-repo",
    latestAnalysis: { checkedAt: "2026-11-01T10:00:00.000Z", score: 40, endorsement: { passed: false, reasons: ["x"] } },
  });
  const listed = repositoryWith({ id: "l", name: "listed-repo", analysisCount: 0, latestAnalysis: null });

  function renderIndex(props: Partial<Parameters<typeof HistoryPageClient>[0]> = {}) {
    return render(
      <HistoryPageClient
        sort="rating"
        direction="desc"
        query="zaak"
        repositories={[maintained, measured, listed]}
        basisset={basisset}
        minUsers={1}
        today="2026-11-19"
        {...props}
      />
    );
  }

  it("offers a chip per status with its count, keeping the search and sort in the link", () => {
    renderIndex();

    const chips = screen.getByRole("group", { name: "Filter by Common Ground status" });
    expect(within(chips).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "All (3)",
      "Listed (1)",
      "Measured (1)",
      "Suitable (0)",
      "Maintained (1)",
      "Retired (0)",
      "In basisset (1)",
      "About the basisset",
    ]);
    expect(within(chips).getByRole("link", { name: "All (3)" }).getAttribute("aria-current")).toBe("true");
    expect(within(chips).getByRole("link", { name: "Maintained (1)" }).getAttribute("href")).toBe(
      "/components?sort=rating&direction=desc&q=zaak&status=maintained"
    );
    expect(within(chips).getByRole("link", { name: "In basisset (1)" }).getAttribute("href")).toBe(
      "/components?sort=rating&direction=desc&q=zaak&basisset=1"
    );
  });

  it("shows only the chosen status and keeps the filter in the sort links and the search form", () => {
    const { container } = renderIndex({ status: "maintained" });

    expect(screen.getByRole("status").textContent).toBe("1 repository matches “zaak” with status Maintained.");
    expect(screen.queryByText("measured-repo")).toBeNull();
    const card = screen.getByRole("link", { name: /open-zaak\/open-zaak/ });
    expect(card.querySelector("[data-lifecycle-status]")?.textContent).toBe("Maintained");
    expect(within(card).getByText("In basisset")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Date ↓" }).getAttribute("href")).toBe(
      "/components?sort=date&direction=desc&q=zaak&status=maintained"
    );
    expect(screen.getByRole("link", { name: "All (3)" }).getAttribute("href")).toBe(
      "/components?sort=rating&direction=desc&q=zaak"
    );
    expect(container.querySelector('input[type="hidden"][name="status"]')?.getAttribute("value")).toBe("maintained");
  });

  it("counts within the basisset and says when nothing has the status", () => {
    renderIndex({ status: "measured", basissetOnly: true });

    expect(screen.getByRole("link", { name: "All (1)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "In basisset (1)" }).getAttribute("href")).toBe(
      "/components?sort=rating&direction=desc&q=zaak&status=measured"
    );
    expect(screen.getByRole("status").textContent).toBe(
      "No repositories match “zaak” with status Measured in the basisset."
    );
  });

  it("gives Listed to a repository without an analysis on the card", () => {
    renderIndex({ status: "listed" });
    expect(screen.getByRole("link", { name: /listed-repo/ }).querySelector("[data-lifecycle-status]")?.textContent).toBe("Listed");
  });
});
