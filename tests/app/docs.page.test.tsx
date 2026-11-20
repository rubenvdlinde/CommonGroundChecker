/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);
vi.mock("next/navigation", () => ({ notFound }));

import RatingGuidePage from "@/app/docs/page";
import CategoryDocPage, { generateStaticParams } from "@/app/docs/[category]/page";
import { ALL_SOURCES, RATING_DOCS, RATING_SCALE, aspectDocHref } from "@/lib/ratingDocs";
import { CHECKLIST_CHANGE_PROPOSAL_URL, CHECKLIST_VERSION } from "@/lib/criteria";

const EXPECTED_MODEL: Record<string, string[]> = {
  security: [
    "vulnerabilities",
    "dependency-freshness",
    "dependency-activity",
    "dependency-licences",
    "dependency-management",
    "container-images",
    "secrets",
    "secure-coding",
    "supply-chain",
  ],
  maintainability: ["analysability", "modifiability", "testability", "modularity", "reusability", "testing"],
  governance: ["licensing", "ownership", "maintenance", "community-documents", "usage-and-ecosystem", "project-health"],
  "deployment-operations": ["containerisation", "release-management"],
  architecture: ["api", "layering", "standards"],
};

async function renderCategory(slug: string) {
  return render(await CategoryDocPage({ params: Promise.resolve({ category: slug }) }));
}

describe("rating docs data", () => {
  it("has the five categories with the expected aspect ids", () => {
    const model = Object.fromEntries(RATING_DOCS.map((category) => [category.slug, category.aspects.map((a) => a.id)]));
    expect(model).toEqual(EXPECTED_MODEL);
  });

  it("uses every category slug and aspect id once", () => {
    const ids = [
      ...RATING_DOCS.map((category) => category.slug),
      ...RATING_DOCS.flatMap((category) => category.aspects.map((aspect) => aspect.id)),
      "code-properties",
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("links only to https sources", () => {
    const urls = [
      ...ALL_SOURCES.map((source) => source.url),
      ...RATING_DOCS.flatMap((category) => category.aspects.flatMap((aspect) => aspect.sources.map((s) => s.url))),
    ];
    for (const url of urls) {
      expect(new URL(url).protocol, url).toBe("https:");
    }
  });

  it("gives every aspect a meaning, a measurement, a rating and sources", () => {
    for (const aspect of RATING_DOCS.flatMap((category) => category.aspects)) {
      expect(aspect.meaning, aspect.id).not.toBe("");
      expect(aspect.criteria.length, aspect.id).toBeGreaterThan(0);
      expect(aspect.rating.length, aspect.id).toBeGreaterThan(0);
      expect(aspect.sources.length, aspect.id).toBeGreaterThan(0);
    }
  });

  it("only leaves layering, standards, usage and project health out of the rating, and only usage is informative", () => {
    const aspects = RATING_DOCS.flatMap((category) => category.aspects);
    expect(aspects.filter((a) => !a.counted).map((a) => a.id).sort()).toEqual([
      "layering",
      "project-health",
      "standards",
      "usage-and-ecosystem",
    ]);
    expect(aspects.filter((a) => a.informative).map((a) => a.id)).toEqual(["usage-and-ecosystem"]);
  });

  it("rates status criteria and complete documents at the ends of the scale", () => {
    const texts = RATING_DOCS.flatMap((category) => category.aspects.flatMap((aspect) => aspect.rating));
    expect(texts.some((text) => /a pass rates 5\.5, a warning 3 and a fail 0\.5/.test(text))).toBe(true);
    expect(texts.some((text) => /all of them rates 5\.5, at least 80% rates 4/.test(text))).toBe(true);
    expect(texts.filter((text) => /\b(rates? 5 |rates 5,|fail 1\b|gives 5 stars)/.test(text))).toEqual([]);
  });

  it("explains the interpolated Open Source Health ratings", () => {
    const security = RATING_DOCS.find((category) => category.slug === "security")!;
    const rating = (id: string) => security.aspects.find((aspect) => aspect.id === id)!.rating.join(" ");
    expect(rating("dependency-freshness")).toMatch(/exactly at the 4-star limit rates 3\.5/);
    expect(rating("dependency-activity")).toMatch(/caps it at 3\.49/);
    expect(rating("dependency-management")).toMatch(/none rates 5\.5, 6% rates 3\.5/);
    expect(rating("vulnerabilities")).toMatch(/None at all rates 5\.5/);
    expect(rating("dependency-licences")).toMatch(/One low-risk licence rates 4\.17/);
  });

  it("builds the anchor link of an aspect", () => {
    expect(aspectDocHref("security", "secrets")).toBe("/docs/security#secrets");
  });
});

describe("RatingGuidePage", () => {
  afterEach(() => cleanup());

  it("links the five category pages and explains how ratings work", () => {
    render(<RatingGuidePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Rating guide" })).toBeTruthy();
    for (const category of RATING_DOCS) {
      expect(screen.getByRole("link", { name: category.title }).getAttribute("href")).toBe(`/docs/${category.slug}`);
    }
    expect(screen.getByRole("heading", { level: 2, name: "How ratings work" })).toBeTruthy();
    expect(screen.getByText(/not a SIG rating and not a certification/)).toBeTruthy();
  });

  it("explains the 0.5 to 5.5 scale and its star bands with its source", () => {
    render(<RatingGuidePage />);

    const section = screen.getByRole("heading", { level: 2, name: "How ratings work" }).closest("section")!;
    expect(within(section).getByText(/rate a pass as 5\.5, a warning as 3 and a fail as 0\.5/)).toBeTruthy();
    expect(within(section).getByText(/All found is 5\.5/)).toBeTruthy();
    expect(within(section).getByText(/a share exactly at the 4-star limit rates 3\.5, and a perfect result 5\.5/)).toBeTruthy();
    expect(within(section).getByText(/4\.5 to 5\.5 is 5 stars, 3\.5 to 4\.5 is 4 stars/)).toBeTruthy();
    expect(within(section).getByRole("link", { name: RATING_SCALE.source.title }).getAttribute("href")).toBe(
      "https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/getting-started/approach.md"
    );
  });

  it("explains Maintained as the level above suitable, with usage never rated", () => {
    render(<RatingGuidePage />);

    const maintained = screen.getByText("A component is Maintained").closest("li");
    expect(maintained?.textContent).toContain("declares the development status stable and at least 1 organisation under usedBy, and there is a valid SLA with a maintainer, on the VNG model contract");
    expect(maintained?.textContent).toContain("proven in practice by one or more municipalities");
    expect(maintained?.textContent).not.toContain("proposal");
    expect(maintained?.textContent).toContain("never gives stars and never counts in a rating");
  });

  it("explains the checklist versions and the transition period, and links the change proposal form", () => {
    render(<RatingGuidePage />);

    expect(screen.getByRole("heading", { level: 2, name: "The checklist and its versions" })).toBeTruthy();
    expect(screen.getByText(new RegExp(`This is version ${CHECKLIST_VERSION.replace(".", "\\.")}\\.`))).toBeTruthy();
    expect(screen.getByText(/Until that date a fail shows as a warning/)).toBeTruthy();
    expect(screen.getByText(/decides within\s+the mandate of the ALV/)).toBeTruthy();
    expect(screen.getByText(/College voor Dienstverleningszaken/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/The community decides|Forum Standaardisatie|management organisation/);
    expect(screen.getByRole("link", { name: "Propose a change to the checklist" }).getAttribute("href")).toBe(
      CHECKLIST_CHANGE_PROPOSAL_URL
    );
  });

  it("calls suitable for Common Ground the programme's threshold, not advice and not a listing condition", () => {
    render(<RatingGuidePage />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/threshold the Common Ground programme uses to decide whether to adopt\s+a component as supported/);
    expect(text).toMatch(/It is not a condition for being listed/);
    expect(text).not.toMatch(/advice/i);
  });

  it("says the checker does not certify and leaves a SIG certificate to the regievoerder", () => {
    render(<RatingGuidePage />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/4 stars is the level at which SIG and TÜViT certify maintainability\. The checker does not\s+certify/);
    expect(text).toMatch(/up to VNG as\s+regievoerder\. The ALV papers do not ask for one\./);
  });
});

describe("CategoryDocPage", () => {
  afterEach(() => cleanup());

  it("generates a page for every category", () => {
    expect(generateStaticParams()).toEqual(Object.keys(EXPECTED_MODEL).map((category) => ({ category })));
  });

  it.each(Object.entries(EXPECTED_MODEL))("renders %s with one anchored h2 section per aspect", async (slug, ids) => {
    const { container } = await renderCategory(slug);
    const category = RATING_DOCS.find((candidate) => candidate.slug === slug)!;

    expect(screen.getByRole("heading", { level: 1, name: category.title })).toBeTruthy();
    for (const aspect of category.aspects) {
      const section = container.querySelector(`section#${aspect.id}`) as HTMLElement | null;
      expect(section, aspect.id).not.toBeNull();
      expect(within(section!).getByRole("heading", { level: 2, name: aspect.title })).toBeTruthy();
      expect(within(section!).getByRole("heading", { level: 3, name: "What it means" })).toBeTruthy();
      expect(within(section!).getByRole("heading", { level: 3, name: "How the checker measures it" })).toBeTruthy();
      for (const source of aspect.sources) {
        expect(within(section!).getByRole("link", { name: source.title }).getAttribute("href")).toBe(source.url);
      }
    }
    expect(Array.from(container.querySelectorAll("section[id]"), (s) => s.id)).toEqual(ids);
  });

  it("shows the code property limits and which levels are derived on the maintainability page", async () => {
    await renderCategory("maintainability");

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "4 stars (published)" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "5 stars (derived)" })).toBeTruthy();
    const analysability = document.getElementById("analysability")!;
    expect(within(analysability).getByText("Duplication")).toBeTruthy();
    expect(within(analysability).getByText("Unit size")).toBeTruthy();
  });

  it("scrolls the wide code property table inside a keyboard reachable region", async () => {
    await renderCategory("maintainability");

    const region = screen.getByRole("region", { name: "Star limits per code property" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("overflow-x-auto");
    const description = document.getElementById("code-property-limits")!;
    expect(region.contains(description)).toBe(false);
    expect(within(region).getByRole("table").getAttribute("aria-describedby")).toBe("code-property-limits");
  });

  it("marks layering as not counted", async () => {
    await renderCategory("architecture");

    expect(within(document.getElementById("layering")!).getByText(/not counted in the rating/)).toBeTruthy();
    expect(within(document.getElementById("api")!).queryByText(/not counted in the rating/)).toBeNull();
  });

  it("explains each usage source and why usage is never rated", async () => {
    await renderCategory("governance");

    const usage = document.getElementById("usage-and-ecosystem")!;
    expect(within(usage).getByText(/never rated, never given stars and not compared across components/)).toBeTruthy();
    expect(within(usage).queryByText(/but not counted in the rating/)).toBeNull();
    for (const name of ["Declared users", "Nextcloud App Store", "GitHub releases", "npm, Packagist and PyPI", "deps.dev"]) {
      expect(within(usage).getByText(name)).toBeTruthy();
    }
    expect(within(usage).getByText(/do not measure quality and cannot be compared fairly/)).toBeTruthy();
  });

  it("returns not found for an unknown category", async () => {
    await expect(renderCategory("unknown")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
