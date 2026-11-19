/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import CommonGroundPathPage from "@/app/docs/common-ground-path/page";
import RatingGuidePage from "@/app/docs/page";
import ToolsAndModelsPage from "@/app/docs/tools-and-models/page";
import {
  AUDIENCES,
  PATH_DOC_HREF,
  PATH_DOC_SOURCES,
  PATH_SECTIONS,
  PATH_STEPS,
  THREE_SYSTEMS_HREF,
  pathStatusLabel,
  type PathStatus,
} from "@/lib/pathDocs";

function allText(): string[] {
  return [
    ...AUDIENCES.flatMap((audience) => [audience.title, audience.text]),
    ...PATH_STEPS,
    ...PATH_SECTIONS.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.items ?? []),
      ...(section.parts ?? []).flatMap((part) => [
        part.title,
        ...part.paragraphs,
        ...(part.items ?? []),
        ...(part.notes ?? []),
        ...(part.table ? [part.table.caption, ...part.table.columns, ...part.table.rows.flat()] : []),
      ]),
    ]),
  ];
}

function statusOf(title: string): PathStatus | undefined {
  for (const section of PATH_SECTIONS) {
    if (section.title === title) return section.status;
    const part = section.parts?.find((candidate) => candidate.title === title);
    if (part) return part.status;
  }
  throw new Error(`no section or part named ${title}`);
}

describe("path docs data", () => {
  it("labels each status", () => {
    expect(pathStatusLabel({ kind: "in-review", pr: 68 })).toBe("In review (#68)");
    expect(pathStatusLabel({ kind: "in-development" })).toBe("In development");
    expect(pathStatusLabel({ kind: "proposed" })).toBe("Proposed");
  });

  it("marks the parts other lanes are building as in development", () => {
    for (const title of ["Maintained", "Nightly measurement and fix terms", "Versions and a transition period", "Counting usage"]) {
      expect(statusOf(title), title).toEqual({ kind: "in-development" });
    }
  });

  it("gives the version choice and the verdict their pull requests", () => {
    expect(statusOf("Which version is measured")).toEqual({ kind: "in-review", pr: 68 });
    expect(statusOf("When a component is suitable")).toEqual({ kind: "in-review", pr: 56 });
    expect(statusOf("A valid maintenance contract")).toEqual({ kind: "in-review", pr: 55 });
  });

  it("measures the declared version first and falls back to the default branch with a warning", () => {
    const version = PATH_SECTIONS.find((section) => section.id === "version")!;
    expect(version.items).toEqual([
      "the tag that matches softwareVersion in publiccode.yml;",
      "the newest stable release;",
      "the newest stable semver tag, such as 1.4.2 or v1.4.2;",
      "the default branch, with a warning that no released version was found.",
    ]);
    expect(version.parts?.[0].paragraphs.join(" ")).toMatch(/scannedRef.*scannedCommit/);
  });

  it("asks a stable developmentStatus for Maintained wherever its conditions are listed", () => {
    const maintained = PATH_SECTIONS.find((section) => section.id === "levels")!.parts!.find((part) => part.title === "Maintained")!;
    expect(maintained.paragraphs[0]).toMatch(/developmentStatus in publiccode\.yml is stable/);
    expect(maintained.paragraphs[0]).toMatch(/A component that leaves stable leaves Maintained and goes back to Suitable for Common Ground/);
    expect(PATH_STEPS.find((step) => step.includes("now Maintained"))).toMatch(/stable in publiccode\.yml/);
    expect(AUDIENCES.find((audience) => audience.id === "buyer")!.text).toMatch(/Maintained adds that the software is stable/);
  });

  it("counts declared users under usedBy and asks no confirmation", () => {
    const usage = PATH_SECTIONS.find((section) => section.id === "usage")!;
    expect(usage.paragraphs[0]).toMatch(/organisations under usedBy in publiccode\.yml\. That is the declared number of users/);
    expect(usage.paragraphs[0]).toMatch(/no separate confirmation step for now/);
    const others = allText().filter((text) => text !== usage.paragraphs[0]);
    for (const text of others) expect(text, text).not.toMatch(/confirm/i);
  });

  it("calls it the setup, not the plan", () => {
    for (const text of [...allText(), ...PATH_DOC_SOURCES.map((source) => source.title)]) {
      expect(text, text).not.toMatch(/\bplan\b/i);
    }
    expect(PATH_DOC_SOURCES[0].title).toBe("The setup behind the checker (issue #54)");
  });

  it("proposes what an SLA for a Maintained component at least covers", () => {
    expect(statusOf("What an SLA covers")).toEqual({ kind: "proposed" });
    const sla = PATH_SECTIONS.flatMap((section) => section.parts ?? []).find((part) => part.title === "What an SLA covers")!;
    expect(sla.items).toHaveLength(2);
    expect(sla.items![0]).toMatch(/above the Suitable for Common Ground level.*within the fix term/);
    expect(sla.items![1]).toMatch(/response and fix times below, as KPIs/);
  });

  it("proposes response and fix times in working days", () => {
    expect(statusOf("Response and fix times")).toEqual({ kind: "proposed" });
    const times = PATH_SECTIONS.flatMap((section) => section.parts ?? []).find((part) => part.title === "Response and fix times")!;
    expect(times.table!.columns).toEqual(["Report", "Respond", "Fix"]);
    expect(times.table!.rows).toEqual([
      ["Critical vulnerability", "1", "7"],
      ["High vulnerability", "2", "30"],
      ["Blocking bug", "2", "10"],
      ["Other bug", "5", "Next release"],
      ["Question or feature request", "10", "No term"],
    ]);
    expect(times.paragraphs[0]).toMatch(/in working days/);
  });

  it("uses every section id once", () => {
    const ids = ["audiences", "steps", ...PATH_SECTIONS.map((section) => section.id), "sources"];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses no em or en dashes", () => {
    for (const text of allText()) expect(text, text).not.toMatch(/[–—]/);
  });

  it("links only to https sources, each once", () => {
    const urls = PATH_DOC_SOURCES.map((source) => source.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(new URL(url).protocol, url).toBe("https:");
  });
});

describe("CommonGroundPathPage", () => {
  afterEach(() => cleanup());

  it("renders the sections in order", () => {
    const { container } = render(<CommonGroundPathPage />);

    expect(screen.getByRole("heading", { level: 1, name: "The path to Common Ground" })).toBeTruthy();
    expect(Array.from(container.querySelectorAll("section[id]"), (section) => section.id)).toEqual([
      "audiences",
      "steps",
      "version",
      "three-systems",
      "verdict",
      "levels",
      "maintenance",
      "usage",
      "checklist",
      "governance",
      "sources",
    ]);
  });

  it("speaks to a buyer, a maintainer and a municipality", () => {
    render(<CommonGroundPathPage />);

    const section = document.getElementById("audiences")!;
    for (const name of ["A buyer", "A maintainer or supplier", "A municipality"]) {
      expect(within(section).getByRole("heading", { level: 3, name })).toBeTruthy();
    }
  });

  it("shows the seven steps in order", () => {
    render(<CommonGroundPathPage />);

    const items = within(document.getElementById("steps")!).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(PATH_STEPS);
  });

  it("shows a status badge next to each heading that has one", () => {
    render(<CommonGroundPathPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Which version is measured In review (#68)" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Maintained In development" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "How the checklist changes Proposed" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Who decides that a component is Maintained" })).toBeTruthy();
  });

  it("names the four verdict conditions and the two levels", () => {
    render(<CommonGroundPathPage />);

    const verdict = document.getElementById("verdict")!;
    expect(within(verdict).getAllByRole("listitem")).toHaveLength(4);
    expect(within(verdict).getByText(/at least 4 stars, the level at which SIG and TÜViT certify/)).toBeTruthy();
    expect(within(verdict).getByText(/The checker does not certify\..*The ALV papers do not ask for one\./)).toBeTruthy();
    expect(within(verdict).getByText(/maintenance\.type: contract/)).toBeTruthy();

    const levels = document.getElementById("levels")!;
    expect(within(levels).getByText(/at least one organisation is listed as a user under usedBy in publiccode\.yml, and there is a valid SLA with a maintainer, on the VNG model contract/)).toBeTruthy();
    expect(within(levels).getByText(/proven in practice by one or more municipalities/)).toBeTruthy();
    expect(levels.textContent).not.toMatch(/is a proposal/);
  });

  it("explains maintenance, usage, the checklist process and that the governance decision is referenced", () => {
    render(<CommonGroundPathPage />);

    expect(within(document.getElementById("maintenance")!).getByText(/New development is not maintenance/)).toBeTruthy();
    expect(within(document.getElementById("maintenance")!).getByText(/first made maintainable/)).toBeTruthy();
    expect(within(document.getElementById("usage")!).getByText(/declared number/)).toBeTruthy();
    const checklist = document.getElementById("checklist")!;
    expect(within(checklist).getByText(/within the mandate the ALV gave it/)).toBeTruthy();
    expect(within(checklist).getByText(/College voor Dienstverleningszaken/)).toBeTruthy();
    expect(checklist.textContent).not.toMatch(/Forum Standaardisatie|management organisation/);
    expect(within(checklist).getByText(/shows it as a warning, not as a fail/)).toBeTruthy();
    expect(within(document.getElementById("governance")!).getByText(/does not make that decision/)).toBeTruthy();
    expect(within(document.getElementById("governance")!).getByText(/validation are tasks of VNG as regievoerder/)).toBeTruthy();
  });

  it("shows the SLA and the response and fix times as a table", () => {
    render(<CommonGroundPathPage />);

    const maintenance = document.getElementById("maintenance")!;
    expect(within(maintenance).getByRole("heading", { level: 3, name: "What an SLA covers Proposed" })).toBeTruthy();
    const table = within(maintenance).getByRole("table", { name: "Proposed response and fix times, in working days" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Report", "Respond", "Fix"]);
    const critical = within(table).getByRole("rowheader", { name: "Critical vulnerability" }).closest("tr")!;
    expect(Array.from(critical.cells, (cell) => cell.textContent)).toEqual(["Critical vulnerability", "1", "7"]);
    expect(within(table).getAllByRole("row")).toHaveLength(6);
  });

  it("links the tools page and every source", () => {
    render(<CommonGroundPathPage />);

    expect(screen.getByRole("link", { name: "Tools and models" }).getAttribute("href")).toBe(THREE_SYSTEMS_HREF);
    for (const source of PATH_DOC_SOURCES) {
      expect(screen.getByRole("link", { name: source.title }).getAttribute("href")).toBe(source.url);
    }
  });
});

describe("links to the path page", () => {
  afterEach(() => cleanup());

  it("is linked from the rating guide", () => {
    render(<RatingGuidePage />);

    expect(screen.getByRole("link", { name: "The path to Common Ground" }).getAttribute("href")).toBe(PATH_DOC_HREF);
  });

  it("is linked from the tools and models page", () => {
    render(<ToolsAndModelsPage />);

    expect(screen.getByRole("link", { name: "The path to Common Ground" }).getAttribute("href")).toBe(PATH_DOC_HREF);
  });
});
