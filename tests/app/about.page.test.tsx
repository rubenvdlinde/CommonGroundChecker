/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import AboutPage from "@/app/about/page";
import { NARROW_LAYOUT, WIDE_LAYOUT, nameLines, transitionKey } from "@/components/LifecycleDiagram";
import { NARROW_ADOPTION_LAYOUT, WIDE_ADOPTION_LAYOUT, adoptionEdgeKey } from "@/components/AdoptionDiagram";
import { CHECKLIST_NODE, NARROW_SOURCES_LAYOUT, WIDE_SOURCES_LAYOUT, sourcesNodes } from "@/components/ChecklistSourcesDiagram";
import {
  ADOPTION_EDGES,
  ADOPTION_NODES,
  ADOPTION_NOTES,
  ADOPTION_STATUS,
  ADOPTION_STEPS,
  ALV_EXPLANATION_URL,
  CG_STATES,
  CG_TRANSITIONS,
  COMPONENT_STATES,
  LEAVING_STABLE,
  LIFECYCLE_RELATION,
  ALV_AGENDA_URL,
  ALV_STANDARD_URL,
  HUGO_REPOSITORY_URL,
  SIG_QUALITY_MODELS_URL,
  CHECKLIST_OUTCOMES,
  CHECKLIST_SOURCES,
  INFORMATION_ONLY,
  NO_CONDITIONS_OF_OUR_OWN,
  SETUP_ISSUE_URL,
  SETUP_POINTS,
  stateName,
} from "@/lib/aboutDocs";
import { STANDARD_FOR_PUBLIC_CODE_URL } from "@/lib/standardForPublicCode";
import {
  ABOUT_REFERENCES,
  ABOUT_SECTIONS,
  KEPT_ANCHORS,
  PRINCIPLE,
  PUBLICCODE_BASIS,
  PUBLICCODE_USES,
  WHAT_IT_IS,
} from "@/lib/aboutStructure";
import SourcesDiagram from "@/components/SourcesDiagram";
import { sourcesDiagramData } from "@/lib/sourcesDiagram";
import { PATH_DOC_HREF, PATH_SECTIONS, RESPONSE_AND_FIX_TIMES, SLA_TERMS } from "@/lib/pathDocs";
import {
  BASISSET_PAGE_HREF,
  COMPARE_PAGE_HREF,
  FUNCTIONALITIES_PAGE_HREF,
  MEASURING_STICK_INTRO,
  MEASURING_STICK_PARTS,
} from "@/lib/measuringStickDocs";

function allText(): string[] {
  return [
    ...SETUP_POINTS.flatMap((point) => [
      point.title,
      ...point.paragraphs,
      ...(point.items ?? []),
      ...(point.tableIntro ? [point.tableIntro] : []),
      point.link.text,
    ]),
    ...CHECKLIST_SOURCES.flatMap((source) => [source.title, source.text, ...source.lines]),
    NO_CONDITIONS_OF_OUR_OWN,
    ...INFORMATION_ONLY,
    ...CG_STATES.flatMap((state) => [state.name, state.text]),
    ...ADOPTION_NODES.flatMap((node) => node.lines),
    ...ADOPTION_STEPS,
    ...ADOPTION_NOTES,
    ...CG_TRANSITIONS.flatMap((transition) => [transition.label, transition.text]),
    ...COMPONENT_STATES.flatMap((state) => [state.name, state.text]),
    ...LIFECYCLE_RELATION.map((row) => row.effect),
  ];
}

describe("about docs data", () => {
  it("names the five Common Ground states in order", () => {
    expect(CG_STATES.map((state) => state.name)).toEqual([
      "Listed",
      "Measured",
      "Suitable for Common Ground",
      "Maintained",
      "Retired",
    ]);
  });

  it("has exactly the transitions of the setup", () => {
    expect(CG_TRANSITIONS.map(transitionKey)).toEqual([
      "listed>measured",
      "measured>suitable",
      "suitable>measured",
      "suitable>maintained",
      "maintained>suitable",
      "maintained>measured",
      "any>retired",
    ]);
    const ids = new Set(CG_STATES.map((state) => state.id));
    for (const transition of CG_TRANSITIONS) {
      expect(transition.from === "any" || ids.has(transition.from), transition.from).toBe(true);
      expect(ids.has(transition.to), transition.to).toBe(true);
    }
  });

  it("marks no state as not shown, as the checker shows every state", () => {
    for (const state of CG_STATES) expect(state.status, state.id).toBeUndefined();
  });

  it("states the suitable verdict and the Maintained conditions", () => {
    const text = (id: string) => CG_STATES.find((state) => state.id === id)!.text;
    expect(text("suitable")).toMatch(
      /no mandatory criterion fails.*at least 2\.5.*valid maintenance contract.*at least 4 stars.*developmentStatus is stable and at least 2 organisations are listed under usedBy/
    );
    expect(text("maintained")).toMatch(/^Suitable, and a valid SLA with a maintainer, on the VNG model contract/);
    expect(text("maintained")).toMatch(/stays Maintained during the term/);
    expect(text("retired")).toMatch(/history stays visible/);
  });

  it("keeps a fix term a note on Maintained, not a state", () => {
    expect(CG_STATES.find((state) => state.id === "maintained")!.note!.join(" ")).toBe(
      "A drop starts a fix term: the maintainer must fix it in time."
    );
    for (const state of CG_STATES) expect(state.name, state.name).not.toMatch(/remedy|out of support/i);
    for (const text of allText()) expect(text, text).not.toMatch(/in remedy|out of support|\bapprov/i);
  });

  it("lists developmentStatus from concept to obsolete and covers each in the relation", () => {
    const names = COMPONENT_STATES.map((state) => state.name);
    expect(names).toEqual(["concept", "development", "beta", "stable", "obsolete"]);
    expect(LIFECYCLE_RELATION.flatMap((row) => row.statuses)).toEqual(names);
  });

  it("lets only a stable component be suitable or Maintained", () => {
    const transition = (key: string) => CG_TRANSITIONS.find((candidate) => transitionKey(candidate) === key)!;
    expect(transition("suitable>maintained").text).toMatch(/^There is a valid SLA/);
    expect(transition("maintained>suitable").text).toMatch(/SLA ended, or a fix term passed/);
    expect(transition("maintained>measured").text).toMatch(/verdict no longer holds/);
    expect(transition("any>retired").text).toMatch(/developmentStatus becomes obsolete/);
    const effect = (status: string) => LIFECYCLE_RELATION.find((row) => row.statuses.includes(status))!.effect;
    for (const status of ["concept", "development", "beta"]) {
      expect(effect(status), status).toMatch(/Cannot be suitable for Common Ground or Maintained/);
    }
    expect(effect("stable")).toMatch(/Only a stable component can be suitable for Common Ground or Maintained/);
  });

  it("moves a Maintained component that leaves stable to measured, or to retired when obsolete", () => {
    expect(LEAVING_STABLE).toEqual([
      { to: ["beta", "development", "concept"], state: "measured" },
      { to: ["obsolete"], state: "retired" },
    ]);
    const others = COMPONENT_STATES.map((state) => state.id).filter((id) => id !== "stable");
    expect(LEAVING_STABLE.flatMap((row) => row.to).sort()).toEqual(others.sort());
  });

  it("names each state, and any state", () => {
    expect(stateName("any")).toBe("Any state");
    expect(stateName("maintained")).toBe("Maintained");
    expect(() => stateName("in-remedy")).toThrow();
  });

  it("links the setup points to the path page sections that exist", () => {
    const sectionIds = new Set(PATH_SECTIONS.map((section) => section.id));
    for (const point of SETUP_POINTS) {
      if (!point.link.href.startsWith(PATH_DOC_HREF)) continue;
      expect(sectionIds.has(point.link.href.split("#")[1]), point.link.href).toBe(true);
    }
  });

  it("counts declared users and asks no confirmation", () => {
    for (const text of allText()) expect(text, text).not.toMatch(/confirm/i);
  });

  it("uses no em or en dashes", () => {
    for (const text of allText()) expect(text, text).not.toMatch(/[–—]/);
  });

  it("calls it the setup, not the plan", () => {
    for (const text of allText()) expect(text, text).not.toMatch(/\bplan\b/i);
  });

  it("has four goals, in order", () => {
    expect(SETUP_POINTS.map((point) => point.title).filter((title) => title.startsWith("Goal"))).toEqual([
      "Goal 1: an open space for components",
      "Goal 2: helping developers improve their code",
      "Goal 3: a neutral and clear rating",
      "Goal 4: trust among organisations",
    ]);
    const text = (id: string) => SETUP_POINTS.find((point) => point.id === id)!.paragraphs.join(" ");
    expect(text("goal-neutral-rating")).toMatch(/good enough to be maintained as part of the Common Ground programme/);
    expect(text("goal-neutral-rating")).toMatch(/compare components/);
    expect(text("goal-trust")).toMatch(/trust that the software and the code are good/);
  });

  it("says organisation pages are being built", () => {
    const point = SETUP_POINTS.find((candidate) => candidate.id === "organisations")!;
    expect(point.status).toEqual({ kind: "in-development" });
    expect(point.paragraphs[0]).toMatch(/A page per organisation shows which components it uses/);
  });

  it("carries the proposed SLA and the response and fix times under maintenance", () => {
    const maintenance = SETUP_POINTS.find((point) => point.id === "maintenance")!;
    expect(maintenance.items).toEqual(SLA_TERMS);
    expect(maintenance.table).toEqual(RESPONSE_AND_FIX_TIMES);
    expect(maintenance.status).toEqual({ kind: "proposed" });
  });

  it("names the four checklist sources and invents nothing about the ALV proposal", () => {
    expect(CHECKLIST_SOURCES.map((source) => source.id)).toEqual(["component-checker", "sig", "alv", "fpc"]);
    const source = (id: string) => CHECKLIST_SOURCES.find((candidate) => candidate.id === id)!;
    expect(source("component-checker").title).toMatch(/Hugo ter Doest's proposal for the original Component Checker/);
    expect(source("component-checker").text).toMatch(/what a repository contains/);
    expect(source("sig").text).toMatch(/ready for certification by SIG and TÜViT.*at least 4 stars for maintainability/);
    expect(source("sig").text).toMatch(/Ready is not certified: certification is a manual assessment by SIG and TÜViT/);
    expect(source("sig").text).toMatch(/The ALV papers do not ask for one\./);
    expect(source("sig").title).toBe("The SIG ratings, as the Common Ground programme currently uses them");
    expect(source("alv").status).toEqual({ kind: "proposed" });
    expect(source("alv").title).toBe("The Common Ground standard v1.0, put to the VNG autumn ALV of 11 December 2026");
    expect(source("alv").text).toMatch(/proven in practice by one or more municipalities/);
    expect(source("alv").text).toMatch(/Haven or Haven\+/);
    expect(source("alv").text).toMatch(/The checker is such a validation service/);
    expect(source("alv").links!.map((link) => link.href)).toEqual([ALV_STANDARD_URL, ALV_AGENDA_URL]);
    expect(source("sig").status).toBeUndefined();
    expect(source("sig").links!.map((link) => link.href)).toEqual([SIG_QUALITY_MODELS_URL]);
    expect(source("component-checker").links!.map((link) => link.href)).toEqual([`${HUGO_REPOSITORY_URL}#readme`, SETUP_ISSUE_URL]);
    expect(source("fpc").title).toBe("The Standard for Public Code of the Foundation for Public Code");
    expect(source("fpc").links!.map((link) => link.href)).toEqual([STANDARD_FOR_PUBLIC_CODE_URL]);
    for (const title of ["Bundle policy and source code", "Require review of contributions", "Use plain English", "Use a coherent style"]) {
      expect(source("fpc").text).toContain(`"${title}"`);
    }
    expect(CHECKLIST_OUTCOMES.map((outcome) => outcome.name)).toEqual(["Suitable for Common Ground", "Maintained"]);
  });

  it("follows the ALV change process for the checklist", () => {
    const text = SETUP_POINTS.find((point) => point.id === "checklist")!.paragraphs.join(" ");
    expect(text).toMatch(/Anyone proposes a change through the issue form/);
    expect(text).toMatch(/decides within the mandate of the ALV/);
    expect(text).toMatch(/Commissie Informatiesamenleving/);
    expect(text).toMatch(/College voor Dienstverleningszaken/);
    for (const all of allText()) expect(all, all).not.toMatch(/Forum Standaardisatie|management organisation/);
  });

  it("adds no conditions of its own and lists what is information only", () => {
    expect(NO_CONDITIONS_OF_OUR_OWN).toMatch(/Artifact Hub.*no conditions of our own/);
    expect(INFORMATION_ONLY).toEqual([
      "GitHub stars and forks",
      "response times",
      "codebase size in person-years",
      "downloads",
      "users",
      "project health",
    ]);
  });
});

describe("ChecklistSourcesDiagram layouts", () => {
  for (const layout of [WIDE_SOURCES_LAYOUT, NARROW_SOURCES_LAYOUT]) {
    it(`places every box and arrow inside the ${layout.id} layout`, () => {
      const ids = sourcesNodes().map((node) => node.id);
      expect(Object.keys(layout.boxes).sort()).toEqual([...ids].sort());
      expect(Object.keys(layout.edges).sort()).toEqual(ids.filter((id) => id !== CHECKLIST_NODE).sort());
      for (const box of Object.values(layout.boxes)) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
        expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
      }
      for (const node of sourcesNodes()) {
        const rows = node.lines.length + (node.status ? 1 : 0);
        expect(rows * 17, node.id).toBeLessThanOrEqual(layout.boxes[node.id].height - 8);
      }
    });
  }

  it("draws its text at 12px or more where each layout is shown", () => {
    // The narrow layout is about 296px wide on a 360px phone; the wide one about 928px from 1024px up.
    expect(NARROW_SOURCES_LAYOUT.fontSize * (296 / NARROW_SOURCES_LAYOUT.width)).toBeGreaterThanOrEqual(12);
    expect(WIDE_SOURCES_LAYOUT.fontSize * (928 / WIDE_SOURCES_LAYOUT.width)).toBeGreaterThanOrEqual(12);
  });

  it("fits each line in its box at about 0.6em per character", () => {
    for (const layout of [WIDE_SOURCES_LAYOUT, NARROW_SOURCES_LAYOUT]) {
      for (const node of sourcesNodes()) {
        for (const line of node.lines) {
          expect(line.length * layout.fontSize * 0.6, `${layout.id} ${line}`).toBeLessThanOrEqual(layout.boxes[node.id].width - 12);
        }
      }
    }
  });
});

describe("AdoptionDiagram layouts", () => {
  for (const layout of [WIDE_ADOPTION_LAYOUT, NARROW_ADOPTION_LAYOUT]) {
    it(`places every node and edge inside the ${layout.id} layout`, () => {
      expect(Object.keys(layout.boxes).sort()).toEqual(ADOPTION_NODES.map((node) => node.id).sort());
      expect(Object.keys(layout.edges).sort()).toEqual(ADOPTION_EDGES.map(adoptionEdgeKey).sort());
      for (const box of Object.values(layout.boxes)) {
        expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
        expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
      }
    });

    it(`fits each line in its box in the ${layout.id} layout at about 0.6em per character`, () => {
      for (const node of ADOPTION_NODES) {
        const box = layout.boxes[node.id];
        expect(node.lines.length * layout.lineHeight + 12, node.id).toBeLessThanOrEqual(box.height);
        for (const line of node.lines) {
          expect(line.length * layout.fontSize * 0.6, `${layout.id} ${line}`).toBeLessThanOrEqual(box.width - 12);
        }
      }
    });
  }

  it("draws its text at 12px or more where each layout is shown", () => {
    // The narrow layout is about 296px wide on a 360px phone; the wide one about 928px from 1024px up.
    expect(NARROW_ADOPTION_LAYOUT.fontSize * (296 / NARROW_ADOPTION_LAYOUT.width)).toBeGreaterThanOrEqual(12);
    expect(WIDE_ADOPTION_LAYOUT.fontSize * (928 / WIDE_ADOPTION_LAYOUT.width)).toBeGreaterThanOrEqual(12);
  });
});

describe("LifecycleDiagram layouts", () => {
  for (const layout of [WIDE_LAYOUT, NARROW_LAYOUT]) {
    it(`places every state and transition in the ${layout.id} layout`, () => {
      expect(Object.keys(layout.boxes).sort()).toEqual(CG_STATES.map((state) => state.id).sort());
      expect(Object.keys(layout.edges).sort()).toEqual(CG_TRANSITIONS.map(transitionKey).sort());
      for (const box of Object.values(layout.boxes)) {
        expect(box.x + layout.boxWidth).toBeLessThanOrEqual(layout.width);
        expect(box.y + 64).toBeLessThanOrEqual(layout.height);
      }
    });
  }

  it("draws its text at 12px or more where each layout is shown", () => {
    // The narrow layout is about 296px wide on a 360px phone; the wide one about 928px from 1024px up.
    const narrowScale = 296 / NARROW_LAYOUT.width;
    expect(NARROW_LAYOUT.nameSize * narrowScale).toBeGreaterThanOrEqual(12);
    expect(NARROW_LAYOUT.labelSize * narrowScale).toBeGreaterThanOrEqual(12);
    const wideScale = 928 / WIDE_LAYOUT.width;
    expect(WIDE_LAYOUT.nameSize * wideScale).toBeGreaterThanOrEqual(12);
    expect(WIDE_LAYOUT.labelSize * wideScale).toBeGreaterThanOrEqual(13);
  });

  it("splits only long names over two lines", () => {
    expect(nameLines("Maintained")).toEqual(["Maintained"]);
    expect(nameLines("Suitable for Common Ground")).toEqual(["Suitable for", "Common Ground"]);
  });
});

describe("AboutPage", () => {
  afterEach(() => cleanup());

  it("keeps the existing content and adds the setup, the checklist sources and the lifecycles", () => {
    const { container } = render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 3, name: "About Common Ground" })).toBeTruthy();
    expect(screen.getByText("Author: Hugo W.L. ter Doest")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View source on GitHub" })).toBeTruthy();
    expect(Array.from(container.querySelectorAll("section[id]"), (section) => section.id)).toEqual([
      "what-it-is",
      "measuring-stick",
      "principle",
      "criteria-sources",
      "publiccode-basis",
      "rating",
      "levels-and-lifecycle",
      "maintenance",
      "comparing",
      "setup",
      "run",
      "references",
    ]);
    for (const id of ["adoption", "common-ground-lifecycle", "component-lifecycle", "lifecycles-relation", "checklist-sources"]) {
      expect(document.getElementById(id), id).toBeTruthy();
    }
  });

  it("gives a short overview of the setup and links the path page", () => {
    render(<AboutPage />);

    const plan = document.getElementById("setup")!;
    expect(screen.getByRole("heading", { level: 2, name: "The setup and the way into the standard" })).toBeTruthy();
    for (const point of SETUP_POINTS) {
      const block = document.getElementById(`setup-${point.id}`)!;
      expect(within(block).getByRole("heading", { level: 3, name: new RegExp(`^${point.title}`) })).toBeTruthy();
    }
    expect(within(plan).getByRole("link", { name: "The path to Common Ground" }).getAttribute("href")).toBe(PATH_DOC_HREF);
    expect(within(plan).getAllByRole("link", { name: "The setup behind the checker (issue #54)" })[0].getAttribute("href")).toBe(
      SETUP_ISSUE_URL,
    );
    expect(within(plan).getByRole("link", { name: "More on the path page: the checklist as a standard" }).getAttribute("href")).toBe(
      `${PATH_DOC_HREF}#checklist`,
    );
    expect(within(plan).getByRole("link", { name: "code.overheid.nl" }).getAttribute("href")).toBe("https://code.overheid.nl");
    expect(within(plan).getByRole("heading", { level: 3, name: "A home at code.overheid.nl Proposed" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Who uses which component In development" })).toBeTruthy();
  });

  it("shows the SLA and the response and fix times on the About page itself", () => {
    render(<AboutPage />);

    const maintenance = document.getElementById("setup-maintenance")!;
    for (const term of SLA_TERMS) expect(within(maintenance).getByText(term)).toBeTruthy();
    const table = within(maintenance).getByRole("table", { name: RESPONSE_AND_FIX_TIMES.caption });
    expect(within(table).getAllByRole("row")).toHaveLength(RESPONSE_AND_FIX_TIMES.rows.length + 1);
    const other = within(table).getByRole("rowheader", { name: "Other bug" }).closest("tr")!;
    expect(Array.from(other.cells, (cell) => cell.textContent)).toEqual(["Other bug", "5", "Next release"]);
  });

  it("draws where the checklist comes from, with a text alternative", () => {
    render(<AboutPage />);

    const section = document.getElementById("criteria-sources")!;
    expect(within(section).getByRole("heading", { level: 2, name: "Where the criteria come from" })).toBeTruthy();
    const images = within(section).getAllByRole("img", { name: /Where the checklist comes from/ });
    expect(images.map((image) => image.getAttribute("data-layout"))).toEqual(["wide", "narrow"]);
    for (const image of images) {
      expect(image.querySelectorAll("[data-node]")).toHaveLength(7);
      expect(image.querySelectorAll("[data-edge]")).toHaveLength(6);
      expect(image.querySelector('[data-node="alv"]')!.textContent).toBe("Common Ground standard v1.0VNG ALV, 11 December 2026Proposed");
    }
    const sources = within(section).getByRole("list", { name: "The four sources" });
    expect(within(sources).getAllByRole("listitem")).toHaveLength(4);
    expect(within(sources).getByText("Proposed")).toBeTruthy();
    expect(within(document.getElementById("principle")!).getByText(NO_CONDITIONS_OF_OUR_OWN)).toBeTruthy();
    const info = within(section).getByRole("list", { name: "Our own additions, shown for information only" });
    expect(within(info).getAllByRole("listitem").map((item) => item.textContent)).toEqual(INFORMATION_ONLY);
  });

  it("draws the Common Ground lifecycle as two labelled images, wide and narrow", () => {
    render(<AboutPage />);

    const section = document.getElementById("common-ground-lifecycle")!;
    const images = within(section).getAllByRole("img", { name: /The Common Ground lifecycle/ });
    expect(images.map((image) => image.getAttribute("data-layout"))).toEqual(["wide", "narrow"]);
    for (const image of images) {
      expect(image.querySelectorAll("[data-state]")).toHaveLength(CG_STATES.length);
      expect(image.querySelectorAll("[data-transition]")).toHaveLength(CG_TRANSITIONS.length);
      expect(image.querySelector('[data-state="maintained"]')!.textContent).toBe(
        "MaintainedA drop starts a fix term:the maintainer must fixit in time."
      );
      expect(image.querySelectorAll("[data-note]")).toHaveLength(3);
    }
  });

  it("gives the states and transitions as text", () => {
    render(<AboutPage />);

    const section = document.getElementById("common-ground-lifecycle")!;
    const states = within(section).getByRole("list", { name: "The states" });
    expect(within(states).getAllByRole("listitem")).toHaveLength(CG_STATES.length);
    expect(within(states).queryByText("Proposed")).toBeNull();

    const table = within(section).getByRole("table", { name: "The transitions" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(CG_TRANSITIONS.length);
    expect(rows[rows.length - 1].textContent).toBe("Any stateRetireddevelopmentStatus becomes obsolete, or the programme retires the component.");
  });

  it("shows the component lifecycle and how the two relate, with the stable rule", () => {
    render(<AboutPage />);

    const flow = screen.getByRole("list", { name: "developmentStatus in publiccode.yml, in order" });
    expect(within(flow).getAllByRole("listitem")).toHaveLength(COMPONENT_STATES.length);

    const relation = document.getElementById("lifecycles-relation")!;
    expect(within(relation).getByText(/A stable component can still be only suitable, for example without a valid SLA\. An obsolete component leads to retired\./)).toBeTruthy();
    expect(within(relation).getByText(/only a stable component can be suitable for Common Ground or Maintained/)).toBeTruthy();
    expect(within(relation).queryByText(/open question/)).toBeNull();
    const leaving = within(relation).getByRole("table", { name: "When a Maintained component leaves stable" });
    expect(within(leaving).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      "beta, development, conceptMeasured",
      "obsoleteRetired",
    ]);
    expect(within(relation).getAllByRole("row")).toHaveLength(LIFECYCLE_RELATION.length + 1 + LEAVING_STABLE.length + 1);
  });

  it("shows how a component enters the standard, as a diagram and as text", () => {
    render(<AboutPage />);

    expect(ADOPTION_STATUS).toEqual({ kind: "proposed", until: "ALV 11 Dec 2026" });
    const section = document.getElementById("adoption")!;
    expect(
      within(section).getByRole("heading", { level: 3, name: "How a component enters the standard (ALV papers) Proposed (ALV 11 Dec 2026)" })
    ).toBeTruthy();
    const images = within(section).getAllByRole("img", { name: /How a component enters the Common Ground standard/ });
    expect(images.map((image) => image.getAttribute("data-layout"))).toEqual(["wide", "narrow"]);
    for (const image of images) {
      expect(image.querySelectorAll("[data-node]")).toHaveLength(ADOPTION_NODES.length);
      expect(image.querySelectorAll("[data-edge]")).toHaveLength(ADOPTION_EDGES.length);
      expect(image.querySelector('[data-edge="checker>regie"] path')!.getAttribute("stroke-dasharray")).toBe("5 4");
      expect(image.querySelector('[data-edge="proposal>regie"] path')!.getAttribute("stroke-dasharray")).toBeNull();
    }
    expect(within(section).getByRole("list", { name: "The steps" }).children).toHaveLength(ADOPTION_STEPS.length);
    expect(within(section).getByRole("list", { name: "What the ALV papers say about the regie" }).textContent).toBe(
      ADOPTION_NOTES.join("")
    );
    expect(within(section).getByRole("link", { name: "The Common Ground standard v1.0 (PDF)" }).getAttribute("href")).toBe(ALV_STANDARD_URL);
    expect(within(section).getByRole("link", { name: "The explanation of the Common Ground proposal (PDF)" }).getAttribute("href")).toBe(
      ALV_EXPLANATION_URL
    );
  });
});

function measuringStickText(): string[] {
  return [
    MEASURING_STICK_INTRO,
    ...MEASURING_STICK_PARTS.flatMap((part) => [
      part.title,
      ...part.paragraphs,
      ...(part.items ?? []).map((item) => item.text),
      ...(part.closing ?? []),
      ...(part.links ?? []).map((link) => link.text),
    ]),
  ];
}

describe("measuring stick docs data", () => {
  it("covers the six points in order", () => {
    expect(MEASURING_STICK_PARTS.map((part) => part.id)).toEqual([
      "problem",
      "grounds",
      "mapping",
      "comparing",
      "maintenance",
      "development",
    ]);
  });

  it("states the two ALV wishes and the missing framework", () => {
    const text = MEASURING_STICK_PARTS[0].paragraphs.join(" ");
    expect(text).toMatch(/taken into maintenance by the programme.*duplication between components is removed/);
    expect(text).toMatch(/That framework is missing, so the choices are not made/);
    expect(text).toMatch(/finger pointing, assumptions and judgements/);
  });

  it("says the checker gives grounds and VNG decides", () => {
    const text = MEASURING_STICK_PARTS[1].paragraphs.join(" ");
    expect(text).toMatch(/Nobody can pitch a component/);
    expect(text).toMatch(/It does not decide\. VNG, as regievoerder, decides/);
  });

  it("shows the comparison page and the functionality map and filters as live, with links to them", () => {
    const part = (id: string) => MEASURING_STICK_PARTS.find((candidate) => candidate.id === id)!;
    expect(part("comparing").status).toBeUndefined();
    expect(part("comparing").paragraphs.join(" ")).toMatch(/right to exist/);
    expect(part("comparing").links!.map((link) => link.href)).toEqual([COMPARE_PAGE_HREF]);
    expect(part("mapping").items!.map((item) => item.status?.kind ?? null)).toEqual([null, null, null]);
    expect(part("mapping").links!.map((link) => link.href)).toEqual([FUNCTIONALITIES_PAGE_HREF]);
  });

  it("links maintenance and further development to the setup and the basisset instead of repeating them", () => {
    const hrefs = (id: string) => MEASURING_STICK_PARTS.find((part) => part.id === id)!.links!.map((link) => link.href);
    expect(hrefs("maintenance")).toEqual(["#setup-maintenance", "#setup-levels"]);
    expect(hrefs("development")).toEqual([BASISSET_PAGE_HREF, "#setup-levels"]);
    const setupIds = new Set(SETUP_POINTS.map((point) => `#setup-${point.id}`));
    for (const part of MEASURING_STICK_PARTS) {
      for (const link of part.links ?? []) {
        if (link.href.startsWith("#setup-")) expect(setupIds.has(link.href), link.href).toBe(true);
      }
    }
  });

  it("uses no dashes, no Title Case headings and no plan or approval wording", () => {
    for (const text of measuringStickText()) {
      expect(text, text).not.toMatch(/[–—]|--/);
      expect(text, text).not.toMatch(/\bplan\b|\bapprov/i);
    }
    for (const part of MEASURING_STICK_PARTS) {
      const words = part.title.split(" ").slice(1);
      expect(words.filter((word) => /^[A-Z][a-z]/.test(word) && !["Common", "Ground", "Maintained"].includes(word)), part.title).toEqual([]);
    }
  });
});

describe("AboutPage measuring stick", () => {
  afterEach(() => cleanup());

  it("shows the six parts, with a badge for what is proposed and links to the compare and functionality pages", () => {
    render(<AboutPage />);

    const section = document.getElementById("measuring-stick")!;
    expect(within(section).getByRole("heading", { level: 2, name: "The problem it answers" })).toBeTruthy();
    const headings = MEASURING_STICK_PARTS.map((part) => document.getElementById(`measuring-stick-${part.id}`)!.querySelector("h3")!.textContent);
    expect(headings).toEqual([
      "The problem: choices without grounds",
      "What the checker adds: grounds for a decision",
      "Mapping standards and functionality",
      "Comparing components",
      "What maintenance means Proposed",
      "Further development: a partial answer",
    ]);
    expect(within(document.getElementById("measuring-stick-mapping")!).queryAllByText("In development")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Compare two components" }).getAttribute("href")).toBe(COMPARE_PAGE_HREF);
    expect(screen.getByRole("link", { name: "The functionality map" }).getAttribute("href")).toBe(FUNCTIONALITIES_PAGE_HREF);
    for (const link of screen.getAllByRole("link", { name: "The basisset, next to what the checker measured" })) {
      expect(link.getAttribute("href")).toBe(BASISSET_PAGE_HREF);
    }
    expect(within(section).getByRole("link", { name: "How a component enters the standard" }).getAttribute("href")).toBe("#adoption");
    expect(document.getElementById("setup-maintenance")).toBeTruthy();
    expect(document.getElementById("setup-levels")).toBeTruthy();
  });
});

describe("About page structure", () => {
  afterEach(() => cleanup());

  it("places every setup point and every measuring stick part exactly once", () => {
    const placed = (kind: string) => ABOUT_SECTIONS.flatMap((section) => section.blocks).filter((block) => block.kind === kind).map((block) => block.id);
    expect([...placed("setup")].sort()).toEqual(SETUP_POINTS.map((point) => point.id).sort());
    expect([...placed("stick")].sort()).toEqual(MEASURING_STICK_PARTS.map((part) => part.id).sort());
    const pageBlocks = placed("page");
    expect(new Set(pageBlocks).size).toBe(pageBlocks.length);
  });

  it("keeps every old anchor, and every anchor the page links to, on the page", () => {
    render(<AboutPage />);
    const anchors = [
      ...KEPT_ANCHORS,
      ...SETUP_POINTS.map((point) => `setup-${point.id}`),
      ...MEASURING_STICK_PARTS.map((part) => `measuring-stick-${part.id}`),
      ...ABOUT_SECTIONS.map((section) => section.id),
    ];
    for (const id of anchors) expect(document.getElementById(id), id).toBeTruthy();
    for (const link of Array.from(document.querySelectorAll('a[href^="#"]'))) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), link.getAttribute("href")!).toBeTruthy();
    }
  });

  it("lists the sections in a table of contents", () => {
    render(<AboutPage />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
      ABOUT_SECTIONS.map((section) => `#${section.id}`),
    );
  });

  it("answers whether publiccode.yml is the basis, with the fields each part of the checker reads", () => {
    render(<AboutPage />);
    const section = document.getElementById("publiccode-basis")!;
    expect(within(section).getByText(/Is publiccode\.yml the basis of the setup\? Partly/)).toBeTruthy();
    expect(within(section).getByText(/The code measurements stand on their own/)).toBeTruthy();
    const table = within(section).getByRole("table", { name: "Which parts of the checker read which publiccode.yml fields" });
    expect(within(table).getAllByRole("row")).toHaveLength(PUBLICCODE_USES.length + 1);
    expect(within(section).getByRole("link", { name: "The publiccode.yml standard" }).getAttribute("href")).toBe("https://yml.publiccode.tools/");
    expect(within(section).getByRole("link", { name: "The Common Ground profile of publiccode.yml" }).getAttribute("href")).toBe(
      "/docs/publiccode-profile",
    );
  });

  it("states the principle: open tools chosen, lines that Common Ground already draws", () => {
    render(<AboutPage />);
    const section = document.getElementById("principle")!;
    expect(within(section).getByText(/We do not build measurement tools/)).toBeTruthy();
    expect(within(section).getByText(/makes those lines visible per component/)).toBeTruthy();
  });

  it("lists each outside reference once", () => {
    const urls = ABOUT_REFERENCES.map((reference) => reference.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(STANDARD_FOR_PUBLIC_CODE_URL);
    expect(urls).toContain(`${HUGO_REPOSITORY_URL}#readme`);
  });

  it("uses no dashes in the new texts", () => {
    const texts = [...WHAT_IT_IS, ...PRINCIPLE, ...PUBLICCODE_BASIS, ...PUBLICCODE_USES.map((use) => use.feature), ...ABOUT_SECTIONS.map((section) => section.title)];
    for (const text of texts) expect(text, text).not.toMatch(/[–—]|--/);
  });
});

describe("SourcesDiagram", () => {
  afterEach(() => cleanup());

  it("shows every measure with its source dots and filters on a selected source", () => {
    const data = sourcesDiagramData();
    render(<SourcesDiagram data={data} />);
    const measures = Array.from(document.querySelectorAll("[data-measure]"));
    expect(measures).toHaveLength(data.groups.reduce((sum, group) => sum + group.measures.length, 0));

    const fpc = screen.getByRole("button", { name: /^Foundation for Public Code/ });
    expect(fpc.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(fpc);
    expect(fpc.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Showing the \d+ measures that follow from Foundation for Public Code/)).toBeTruthy();
    for (const measure of measures as HTMLElement[]) {
      const hit = measure.dataset.sources!.split(" ").includes("fpc");
      expect(measure.style.opacity, measure.dataset.measure).toBe(hit ? "1" : "0.3");
    }
    fireEvent.click(fpc);
    expect(fpc.getAttribute("aria-pressed")).toBe("false");
    for (const measure of measures as HTMLElement[]) expect(measure.style.opacity).toBe("1");
  });
});
