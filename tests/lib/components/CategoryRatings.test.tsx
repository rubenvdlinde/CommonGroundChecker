/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import CategoryRatings from "@/components/CategoryRatings";
import { mapMaintainabilityReport, type MaintainabilityReport } from "@/lib/checkers/maintainability";
import { resolveCategory } from "@/lib/aspects";
import type { CheckResult, SizeMeasurement } from "@/lib/types";
import { mapSize } from "@/lib/checkers/size";
import openZaakFixture from "../../fixtures/maintainability-report-open-zaak.json";
import openZaakSizeFixture from "../../fixtures/size-open-zaak.json";

const MAINTAINABILITY = resolveCategory("Maintainability") as string;

function result(id: string, status: CheckResult["status"]): CheckResult {
  return { id, title: `${id} title`, description: "", status, message: "" };
}

const maintainability = mapMaintainabilityReport(openZaakFixture as unknown as MaintainabilityReport);
const size = mapSize(openZaakSizeFixture as SizeMeasurement);

function renderRatings(extra: CheckResult[] = [size]) {
  return render(
    <CategoryRatings
      results={[
        maintainability,
        result("license", "pass"),
        result("eupllicense", "warn"),
        result("documentation", "pass"),
        ...extra,
      ]}
      categoryRatings={{ Governance: 3.8, [MAINTAINABILITY]: 2.6 }}
      aspectRatings={{
        licensing: { rating: 4 },
        "community-documents": { rating: 4, found: 4, expected: 5 },
        testability: { rating: 1.76 },
        ownership: { rating: null },
      }}
    />
  );
}

describe("CategoryRatings", () => {
  afterEach(() => cleanup());

  it("draws a meter per rated aspect on the 0.5 to 5.5 scale, with white ticks on the fill", () => {
    renderRatings();

    const meter = screen.getByRole("meter", { name: "Testability 1.8 of 5.5" });
    expect(meter.getAttribute("aria-valuemin")).toBe("0.5");
    expect(meter.getAttribute("aria-valuemax")).toBe("5.5");
    expect(meter.getAttribute("aria-valuenow")).toBe("1.76");
    expect((meter.firstElementChild as HTMLElement).style.width).toBe("25.2%");
    const ticks = Array.from(meter.querySelectorAll("span[aria-hidden='true']"));
    expect(ticks).toHaveLength(4);
    expect(ticks.map((tick) => tick.className.includes("bg-white"))).toEqual([true, false, false, false]);
  });

  it("says not measured for an aspect without a rating, without a meter", () => {
    renderRatings();

    const ownership = screen.getByRole("group", { name: "Ownership" });
    expect(within(ownership).queryByRole("meter")).toBeNull();
    expect(within(ownership).getByText("not measured")).toBeTruthy();
  });

  it("links each category and aspect to its page in the rating guide", () => {
    renderRatings();

    expect(screen.getByRole("link", { name: "Governance" }).getAttribute("href")).toBe("/docs/governance");
    expect(screen.getByRole("link", { name: MAINTAINABILITY }).getAttribute("href")).toBe("/docs/maintainability");
    expect(screen.getByRole("link", { name: "Testability" }).getAttribute("href")).toBe("/docs/maintainability#testability");
    expect(screen.getByRole("link", { name: "Community documents" }).getAttribute("href")).toBe(
      "/docs/governance#community-documents"
    );
  });

  it("shows the category stars and number", () => {
    renderRatings();

    expect(screen.getByRole("img", { name: "Governance rating 3.8 of 5.5, 4 stars" })).toBeTruthy();
  });

  it("puts the measurements with their thresholds under a maintainability aspect", () => {
    renderRatings();

    const table = screen.getByRole("table", { name: "What Testability is made of" });
    const measurements = screen.getByRole("region", { name: "What Testability is made of" });
    expect(measurements.getAttribute("tabindex")).toBe("0");
    // Positioned, so the visually hidden star text in its cells is clipped by it rather than widening the page
    expect(measurements.className).toContain("relative");
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual([
      "Measured",
      "Value",
      "★★★★★5 stars",
      "★★★★☆4 stars",
      "★★★☆☆3 stars",
      "★★☆☆☆2 stars",
      "Earned",
    ]);
    expect(within(table).getByRole("rowheader", { name: "Unit complexity" }).getAttribute("scope")).toBe("rowgroup");
    const row = within(table).getByRole("row", { name: /Python, complexity above 5/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "34.8%",
      "≤ 15.8%",
      "≤ 20.7%",
      "≤ 27.7%",
      "≤ 34.6%",
      "★☆☆☆☆1 star",
    ]);
    const independence = within(table).getByRole("row", { name: /^Python 81.1%/ });
    expect(within(independence).getAllByText("no level")).toHaveLength(2);
    expect(within(independence).getByText("below 4 stars")).toBeTruthy();
  });

  it("lists the documents of a document-count aspect as found or missing", () => {
    renderRatings();

    const group = screen.getByRole("group", { name: "Community documents" });
    expect(within(group).getByText("4 of 5 found")).toBeTruthy();
    const table = within(group).getByRole("table", { name: "What Community documents is made of" });
    expect(within(table).getByRole("row", { name: /documentation title.*Found/ })).toBeTruthy();
  });

  it("lists the criteria of a normal aspect with status, stars and a link to the card", () => {
    renderRatings();

    const table = screen.getByRole("table", { name: "What Licensing is made of" });
    const row = within(table).getByRole("row", { name: /eupllicense title/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Warning", "★★★☆☆3 stars 3.0"]);
    expect(within(row).getByRole("link").getAttribute("href")).toBe("#criterion-eupllicense");
  });

  it("shows an informative aspect without a meter, with its metrics and their CHAOSS links", () => {
    const health: CheckResult = {
      ...result("projecthealth", "info"),
      metrics: [
        {
          id: "contributor-absence-factor",
          name: "Contributor Absence Factor",
          referenceUrl: "https://chaoss.community/kb/metric-contributor-absence-factor/",
          value: "1",
          explanation: "One person made half of the commits.",
        },
        {
          id: "issue-response-time",
          name: "Issue Response Time",
          referenceUrl: "https://chaoss.community/kb/metric-issue-response-time/",
          value: null,
          explanation: "Not measured: the repository has its issue tracker switched off.",
        },
      ],
    };
    render(<CategoryRatings results={[health]} categoryRatings={{}} aspectRatings={{ "project-health": { rating: null } }} />);

    const group = screen.getByRole("group", { name: /^Project health/ });
    expect(within(group).queryByRole("meter")).toBeNull();
    expect(within(group).getByRole("heading", { name: /^Project health\s*\(informative, not rated\)$/ })).toBeTruthy();
    expect(within(group).getAllByText(/informative, not rated/)).toHaveLength(1);
    const table = within(group).getByRole("table", { name: "What Project health is made of" });
    const absence = within(table).getByRole("row", { name: /Contributor Absence Factor/ });
    expect(within(absence).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "1",
      "One person made half of the commits.",
    ]);
    expect(within(absence).getByRole("link").getAttribute("href")).toBe(
      "https://chaoss.community/kb/metric-contributor-absence-factor/"
    );
    expect(within(within(table).getByRole("row", { name: /Issue Response Time/ })).getByText("not measured")).toBeTruthy();
  });

  it("keeps each aspect's table collapsed under its bar, with a labelled summary", () => {
    renderRatings();

    const table = screen.getByRole("table", { name: "What Licensing is made of" });
    const details = table.closest("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe("Show what Licensing is made of");
  });

  it("shows the size as lines of code, not rated, with the languages and both effort figures", () => {
    renderRatings();

    const group = screen.getByRole("group", { name: /^Size/ });
    expect(within(group).queryByRole("meter")).toBeNull();
    expect(within(group).getByText("(informative, not rated)")).toBeTruthy();
    expect(within(group).getByText("42,010 lines of code, not rated")).toBeTruthy();
    const table = within(group).getByRole("table", { name: /What Size is made of: production code, counted with scc 4.1.0/ });
    const python = within(table).getByRole("row", { name: /^Python/ });
    expect(within(python).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["342", "38,066"]);
    expect(within(group).getByText(/^4.1 person-years \(914 function points/)).toBeTruthy();
    expect(within(group).getByText(/^6.4 person-years, from the SIG v17.0/).textContent).toContain(
      "Context, not part of the 2026 rating."
    );
  });

  it("says why the size was not measured", () => {
    renderRatings([{ ...result("size", "info"), message: "Not measured: scc 4.1.0 could not run." }]);

    const group = screen.getByRole("group", { name: /^Size/ });
    expect(within(group).getByText("not measured")).toBeTruthy();
    expect(within(group).getByText("Not measured: scc 4.1.0 could not run.")).toBeTruthy();
  });

  it("shows usage per source with its date and caveat, without a meter or stars", () => {
    const usage = result("usage", "info");
    usage.usage = {
      sources: [
        {
          id: "dockerhub:openzaak/open-zaak",
          kind: "containers",
          source: "Docker Hub",
          subject: "openzaak/open-zaak",
          url: "https://hub.docker.com/r/openzaak/open-zaak",
          measuredAt: "2026-11-18",
          caveat: "Includes CI pulls.",
          figures: [{ label: "pulls in total", value: 645727 }],
        },
        {
          id: "ghcr:open-zaak/open-zaak",
          kind: "containers",
          source: "GitHub Container Registry",
          subject: "open-zaak/open-zaak",
          url: null,
          measuredAt: "2026-11-18",
          caveat: "Would include CI pulls.",
          figures: [],
          notMeasured: "no public count",
        },
      ],
    };
    render(<CategoryRatings results={[usage]} categoryRatings={{}} aspectRatings={{}} />);

    const group = screen.getByRole("group", { name: /Usage and ecosystem/ });
    expect(within(group).getByText("(informative, not rated)")).toBeTruthy();
    expect(within(group).queryByRole("meter")).toBeNull();
    expect(group.textContent).not.toMatch(/[★☆]|not measured$/);
    const pulls = within(group).getByRole("row", { name: /Docker Hub: openzaak\/open-zaak/ });
    expect(within(pulls).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Container pulls",
      "645,727 pulls in total",
      "2026-11-18",
      "Includes CI pulls.",
    ]);
    expect(within(group).getByText("not measured: no public count")).toBeTruthy();
    const details = within(group).getByRole("table", { name: /What the sources say about Usage and ecosystem/ }).closest("details");
    expect(details?.open).toBe(false);
    expect(details?.querySelector("summary")?.textContent).toBe("Show what Usage and ecosystem is made of");
    expect(details?.querySelector("summary")?.className).toContain("py-3.5");
    const region = within(group).getByRole("region", { name: /What the sources say about Usage and ecosystem/ });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("relative");
  });

  it("leaves usage out when no source found anything", () => {
    const usage = { ...result("usage", "info"), usage: { sources: [] } };
    render(<CategoryRatings results={[usage]} categoryRatings={{}} aspectRatings={{}} />);

    expect(screen.queryByRole("group", { name: /Usage and ecosystem/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Licensing" })).toBeTruthy();
  });

  it("scrolls each wide table in a keyboard reachable region and gives links 44px touch targets", () => {
    renderRatings();

    const region = screen.getByRole("region", { name: "What Licensing is made of" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("overflow-x-auto");
    expect(region.className).toContain("relative");
    expect(within(region).getByRole("table", { name: "What Licensing is made of" })).toBeTruthy();
    for (const link of within(region).getAllByRole("link")) {
      expect(link.className).toContain("min-h-[44px]");
      expect(link.className).toContain("lg:min-h-0");
    }
    expect(region.closest("details")?.querySelector("summary")?.className).toContain("py-3.5");
  });

  it("marks a rated aspect with weight 0 as not counted", () => {
    renderRatings();

    expect(screen.getByRole("heading", { name: /^Layering\s*\(not counted\)$/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "API" })).toBeTruthy();
  });

  it("shows the open-track rating under the Maintainability header, linked to its criterion and not counted", () => {
    const openTrack: CheckResult = { ...result("opentrack", "info"), rating: 2.94, starRating: 3 };
    render(
      <CategoryRatings
        results={[maintainability, openTrack]}
        categoryRatings={{ [MAINTAINABILITY]: 2.6 }}
        aspectRatings={{}}
      />
    );

    const section = screen.getByRole("region", { name: MAINTAINABILITY });
    const link = within(section).getByRole("link", { name: "Open track" });
    expect(link.getAttribute("href")).toBe("#criterion-opentrack");
    const line = link.closest("p") as HTMLElement;
    expect(line.textContent).toBe("Open track: 2.9 ★★★☆☆3 stars (informative, not counted)");
  });

  it("shows no open-track line without an open-track rating", () => {
    renderRatings();

    expect(screen.queryByRole("link", { name: "Open track" })).toBeNull();
  });
});
