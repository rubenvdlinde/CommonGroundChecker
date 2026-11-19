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
import { ALL_SOURCES, RATING_DOCS, aspectDocHref } from "@/lib/ratingDocs";

const EXPECTED_MODEL: Record<string, string[]> = {
  security: [
    "vulnerabilities",
    "dependency-freshness",
    "dependency-activity",
    "dependency-licences",
    "dependency-management",
    "secrets",
    "secure-coding",
    "supply-chain",
  ],
  maintainability: ["analysability", "modifiability", "testability", "modularity", "reusability", "testing"],
  governance: ["licensing", "ownership", "maintenance", "community-documents", "usage-and-ecosystem"],
  "deployment-operations": ["containerisation", "release-management"],
  architecture: ["api", "layering"],
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

  it("only leaves layering and usage out of the rating, and only usage is informative", () => {
    const aspects = RATING_DOCS.flatMap((category) => category.aspects);
    expect(aspects.filter((a) => !a.counted).map((a) => a.id).sort()).toEqual(["layering", "usage-and-ecosystem"]);
    expect(aspects.filter((a) => a.informative).map((a) => a.id)).toEqual(["usage-and-ecosystem"]);
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

  it("explains Approved as the level above suitable, with usage never rated", () => {
    render(<RatingGuidePage />);

    const approved = screen.getByText("A component is approved").closest("li");
    expect(approved?.textContent).toContain("declares the development status stable and at least 2 organisations under usedBy, and an SLA is valid");
    expect(approved?.textContent).toContain("The minimum is a proposal");
    expect(approved?.textContent).toContain("never gives stars and never counts in a rating");
  });

  it("calls suitable for Common Ground the programme's threshold, not advice and not a listing condition", () => {
    render(<RatingGuidePage />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/threshold the Common Ground programme uses to decide whether to adopt\s+a component as supported/);
    expect(text).toMatch(/It is not a condition for being listed/);
    expect(text).not.toMatch(/advice/i);
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
