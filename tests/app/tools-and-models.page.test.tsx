/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import ToolsAndModelsPage from "@/app/docs/tools-and-models/page";
import RatingGuidePage from "@/app/docs/page";
import CategoryDocPage from "@/app/docs/[category]/page";
import {
  DEVIATIONS,
  LIMITS,
  REJECTED_TOOLS,
  TOOL_GROUPS,
  TOOLS_DOC_HREF,
  TOOLS_DOC_SOURCES,
  THREE_SYSTEMS,
  TWO_TRACKS,
  WHY_BOTH,
} from "@/lib/toolsDocs";

function allText(): string[] {
  return [
    ...THREE_SYSTEMS.flatMap((system) => [system.title, ...system.paragraphs]),
    ...TWO_TRACKS.flatMap((track) => [track.title, ...track.paragraphs]),
    WHY_BOTH,
    ...TOOL_GROUPS.flatMap((group) => group.rows.flatMap((row) => Object.values(row).map(String))),
    ...DEVIATIONS.flatMap((deviation) => Object.values(deviation)),
    ...REJECTED_TOOLS.flatMap((rejected) => Object.values(rejected)),
    ...LIMITS,
  ];
}

describe("tools and models data", () => {
  it("gives every tool row a tool, version, licence and both sides of what it proves", () => {
    for (const row of TOOL_GROUPS.flatMap((group) => group.rows)) {
      for (const field of [row.tool, row.version, row.licence, row.proves, row.doesNotProve]) {
        expect(field, row.measure).not.toBe("");
      }
    }
  });

  it("covers the open and the estimate track", () => {
    const tracks = new Set(TOOL_GROUPS.flatMap((group) => group.rows.map((row) => row.track)));
    for (const track of ["open", "estimate", "both"]) expect(tracks.has(track as never), track).toBe(true);
  });

  it("names the rejected tools Ruben asked about", () => {
    const tools = REJECTED_TOOLS.map((rejected) => rejected.tool).join(" | ");
    for (const name of ["Quamoco", "Maintainability Index", "code-maat", "COCOMO", "SLOCCount", "Criticality Score", "SonarQube"]) {
      expect(tools).toContain(name);
    }
  });

  it("uses no em or en dashes", () => {
    for (const text of allText()) expect(text, text).not.toMatch(/[–—]/);
  });

  it("links only to https sources, each once", () => {
    const urls = TOOLS_DOC_SOURCES.map((source) => source.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(new URL(url).protocol, url).toBe("https:");
  });
});

describe("what the checker reports", () => {
  afterEach(() => cleanup());

  it("explains the three systems and the four conditions of the verdict", () => {
    render(<ToolsAndModelsPage />);

    const section = document.getElementById("three-systems")!;
    for (const system of THREE_SYSTEMS) {
      expect(within(section).getByRole("heading", { level: 3, name: system.title })).toBeTruthy();
    }
    expect(
      within(section).getByText(
        /no mandatory criterion fails, the overall rating is at least 2\.5, it has a valid maintenance contract, and the maintainability estimate is at least 4 stars \(a rating of 3\.5 or more\)/
      )
    ).toBeTruthy();
    expect(within(section).getByText(/most components will not reach 4 stars/)).toBeTruthy();
  });

  it("names Simian 4.2.1 as the estimate's duplication cross-check and jscpd 4.0.5 only as replaced", () => {
    const rows = TOOL_GROUPS.flatMap((group) => group.rows).filter((row) => row.track === "estimate");
    const duplication = rows.find((row) => row.measure === "Duplication");
    const crossCheck = rows.find((row) => row.measure === "Duplication cross-check");

    expect(`${duplication?.tool} ${duplication?.version} ${duplication?.licence}`).not.toContain("jscpd");
    expect(duplication?.tool).toContain("Simian 4.2.1");
    expect(crossCheck).toMatchObject({ version: "4.2.1", tool: "Simian in strict mode, replacing jscpd 4.0.5" });
    expect(REJECTED_TOOLS.find((rejected) => rejected.tool === "jscpd 4.0.5")?.reason).toContain("Simian 4.2.1 replaces it");
  });

  it("gives every in-review row its pull request", () => {
    for (const row of TOOL_GROUPS.flatMap((group) => group.rows).filter((candidate) => candidate.inReview)) {
      expect(row.pr, row.measure).toBeGreaterThan(0);
    }
  });
});

describe("ToolsAndModelsPage", () => {
  afterEach(() => cleanup());

  it("renders the six sections in order", () => {
    const { container } = render(<ToolsAndModelsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Tools and models" })).toBeTruthy();
    expect(Array.from(container.querySelectorAll("section[id]"), (section) => section.id)).toEqual([
      "three-systems",
      "two-tracks",
      "tools",
      "deviations",
      "rejected",
      "limits",
    ]);
    for (const name of [
      "What the checker reports",
      "Two tracks, and why both",
      "Tools per measure",
      "Where we deviate from SIG, and why",
      "Tools we tested and rejected",
      "Limits",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
  });

  it("says plainly that the estimate is not calibrated against SIG audits", () => {
    render(<ToolsAndModelsPage />);

    expect(screen.getAllByText(/not calibrated against real SIG audits/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/published model v18\.1 only/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows one table per category with every tool row, and marks rows in review", () => {
    render(<ToolsAndModelsPage />);

    for (const group of TOOL_GROUPS) {
      const table = screen.getByRole("table", { name: group.title });
      expect(within(table).getAllByRole("row")).toHaveLength(group.rows.length + 1);
      expect(within(table).getByRole("columnheader", { name: "What it does not prove" })).toBeTruthy();
    }
    const duplication = screen.getByRole("table", { name: "Maintainability" });
    expect(within(duplication).getAllByText(/\(in review/).length).toBe(
      TOOL_GROUPS[0].rows.filter((row) => row.inReview).length
    );
    expect(within(duplication).getByText(/\(in review, #66\)/)).toBeTruthy();
  });

  it("lists every deviation, every rejected tool and every source", () => {
    render(<ToolsAndModelsPage />);

    for (const deviation of DEVIATIONS) {
      expect(screen.getByRole("rowheader", { name: deviation.topic })).toBeTruthy();
    }
    const rejected = document.getElementById("rejected")!;
    for (const tool of REJECTED_TOOLS) {
      expect(within(rejected).getByText(tool.tool)).toBeTruthy();
    }
    for (const source of TOOLS_DOC_SOURCES) {
      expect(screen.getByRole("link", { name: source.title }).getAttribute("href")).toBe(source.url);
    }
  });
});

describe("links to the tools and models page", () => {
  afterEach(() => cleanup());

  it("is linked from the rating guide", () => {
    render(<RatingGuidePage />);

    expect(screen.getByRole("link", { name: "Tools and models" }).getAttribute("href")).toBe(TOOLS_DOC_HREF);
  });

  it("is linked from the maintainability page and not from the others", async () => {
    render(await CategoryDocPage({ params: Promise.resolve({ category: "maintainability" }) }));
    expect(screen.getByRole("link", { name: "Tools and models" }).getAttribute("href")).toBe(TOOLS_DOC_HREF);
    cleanup();

    render(await CategoryDocPage({ params: Promise.resolve({ category: "security" }) }));
    expect(screen.queryByRole("link", { name: "Tools and models" })).toBeNull();
  });
});
