/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import HistoryPageClient, { filterOptions } from "@/components/HistoryPageClient";
import type { RepoSummary } from "@/generated/openapi-client";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
}));

function repository(owner: string, name: string, extra: Record<string, unknown> = {}): RepoSummary {
  return {
    id: `${owner}/${name}`,
    owner,
    name,
    repoUrl: `https://github.com/${owner}/${name}`,
    analysisCount: 1,
    latestAnalysis: { checkedAt: "2026-11-01T10:00:00Z", score: 71, ...((extra.latestAnalysis as object) ?? {}) },
    ...extra,
  } as unknown as RepoSummary;
}

const ZAKEN = ["Found in the repository, not declared: Zaken API 1.5.1 in src/openapi.yaml (by title)"];
const repositories = [
  repository("open-zaak", "open-zaak", {
    functionalities: ["registreren-en-delen-van-zaken"],
    latestAnalysis: { standardsEvidence: ZAKEN },
  }),
  repository("maykinmedia", "open-object", { functionalities: ["registreren-en-delen-van-basisgegevens"] }),
  repository("ConductionNL", "openregister", { functionalities: ["registreren-en-delen-van-basisgegevens"] }),
];
const names = {
  "registreren-en-delen-van-zaken": "Registreren en delen van zaken",
  "registreren-en-delen-van-basisgegevens": "Registreren en delen van basisgegevens",
};

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("filterOptions", () => {
  it("counts each value once per entry, sorts by name and keeps the selected value", () => {
    expect(filterOptions([["b", "a", "a"], ["a"], null], { a: "Alpha", b: "Beta" }, "c")).toEqual([
      { id: "a", name: "Alpha", count: 2 },
      { id: "b", name: "Beta", count: 1 },
      { id: "c", name: "c", count: 0 },
    ]);
  });
});

describe("Components filters", () => {
  it("shows only the components with the functionality and the standard", () => {
    render(
      <HistoryPageClient
        sort="rating"
        direction="desc"
        query=""
        repositories={repositories}
        functionality="registreren-en-delen-van-basisgegevens"
        functionalityNames={names}
      />
    );
    expect(screen.queryByText("open-zaak/open-zaak")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("2 repositories match");
    expect(screen.getByRole("status").textContent).toContain("that list “Registreren en delen van basisgegevens”");

    cleanup();
    render(<HistoryPageClient sort="rating" direction="desc" query="" repositories={repositories} standard="zgw-zaken" />);
    expect(screen.getByRole("status").textContent).toContain("1 repository matches with any status that support Zaken API");
  });

  it("puts the chosen functionality in the URL, keeping the other filters", () => {
    render(
      <HistoryPageClient
        sort="score"
        direction="asc"
        query="open"
        repositories={repositories}
        basissetOnly
        standard="zgw-zaken"
        functionalityNames={names}
      />
    );
    const select = screen.getByLabelText("Functionality") as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Any functionality",
      "Registreren en delen van basisgegevens (2)",
      "Registreren en delen van zaken (1)",
    ]);
    fireEvent.change(select, { target: { value: "registreren-en-delen-van-zaken" } });
    expect(push).toHaveBeenCalledWith(
      "/components?sort=score&direction=asc&q=open&basisset=1&functionality=registreren-en-delen-van-zaken&standard=zgw-zaken",
      { scroll: false }
    );
    const standards = screen.getByLabelText("Standard") as HTMLSelectElement;
    expect([...standards.options].map((option) => option.textContent)).toEqual(["Any standard", "Zaken API (1)"]);
  });
});

describe("Selecting two components to compare", () => {
  it("offers the compare link once two are selected, and keeps at most two", () => {
    render(<HistoryPageClient sort="rating" direction="desc" query="" repositories={repositories} />);
    expect(screen.getByText("Select two components to compare them.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Select open-zaak/open-zaak to compare"));
    expect(screen.queryByRole("link", { name: "Compare these two" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Select maykinmedia/open-object to compare"));
    expect(screen.getByRole("link", { name: "Compare these two" }).getAttribute("href")).toBe(
      "/compare?a=open-zaak/open-zaak&b=maykinmedia/open-object"
    );
    fireEvent.click(screen.getByLabelText("Select ConductionNL/openregister to compare"));
    expect(screen.getByRole("link", { name: "Compare these two" }).getAttribute("href")).toBe(
      "/compare?a=maykinmedia/open-object&b=ConductionNL/openregister"
    );
    expect((screen.getByLabelText("Select open-zaak/open-zaak to compare") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getByText("Select two components to compare them.")).toBeTruthy();
  });
});
