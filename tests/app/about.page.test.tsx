/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

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
  CHECKLIST_OUTCOMES,
  CHECKLIST_SOURCES,
  INFORMATION_ONLY,
  NO_CONDITIONS_OF_OUR_OWN,
  SETUP_ISSUE_URL,
  SETUP_POINTS,
  stateName,
} from "@/lib/aboutDocs";
import { PATH_DOC_HREF, PATH_SECTIONS, RESPONSE_AND_FIX_TIMES, SLA_TERMS } from "@/lib/pathDocs";

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

  it("marks the states the checker does not show yet", () => {
    const status = Object.fromEntries(CG_STATES.map((state) => [state.id, state.status]));
    expect(status.listed).toBeUndefined();
    expect(status.measured).toBeUndefined();
    expect(status.suitable).toEqual(PATH_SECTIONS.find((section) => section.id === "verdict")!.status);
    expect(status.maintained).toEqual({ kind: "in-development" });
    expect(status.retired).toEqual({ kind: "proposed" });
  });

  it("states the suitable verdict and the Maintained conditions", () => {
    const text = (id: string) => CG_STATES.find((state) => state.id === id)!.text;
    expect(text("suitable")).toMatch(/no mandatory criterion fails.*at least 2\.5.*valid maintenance contract.*at least 4 stars/);
    expect(text("maintained")).toMatch(
      /developmentStatus stable, at least one user listed under usedBy in publiccode\.yml, and a valid SLA with a maintainer, on the VNG model contract/
    );
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

  it("lets only a stable component be Maintained", () => {
    const transition = (key: string) => CG_TRANSITIONS.find((candidate) => transitionKey(candidate) === key)!;
    expect(transition("suitable>maintained").text).toMatch(/^The software is stable/);
    expect(transition("maintained>suitable").text).toMatch(/SLA ended.*fewer organisations.*from stable to beta, development or concept.*fix term passed/);
    expect(transition("maintained>measured").text).toMatch(/verdict no longer holds/);
    expect(transition("any>retired").text).toMatch(/developmentStatus becomes obsolete/);
    const effect = (status: string) => LIFECYCLE_RELATION.find((row) => row.statuses.includes(status))!.effect;
    for (const status of ["concept", "development", "beta"]) expect(effect(status), status).toMatch(/Cannot be Maintained/);
    expect(effect("stable")).toMatch(/Only a stable component can be Maintained/);
  });

  it("moves a Maintained component that leaves stable back to suitable, or to retired when obsolete", () => {
    expect(LEAVING_STABLE).toEqual([
      { to: ["beta", "development", "concept"], state: "suitable" },
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

  it("names the three checklist sources and invents nothing about the ALV proposal", () => {
    expect(CHECKLIST_SOURCES.map((source) => source.id)).toEqual(["component-checker", "sig", "alv"]);
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

    expect(screen.getByRole("heading", { level: 2, name: "About Common Ground" })).toBeTruthy();
    expect(screen.getByText("Author: Hugo W.L. ter Doest")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View source on GitHub" })).toBeTruthy();
    expect(Array.from(container.querySelectorAll("section[id]"), (section) => section.id)).toEqual([
      "setup",
      "checklist-sources",
      "adoption",
      "common-ground-lifecycle",
      "component-lifecycle",
      "lifecycles-relation",
    ]);
  });

  it("gives a short overview of the setup and links the path page", () => {
    render(<AboutPage />);

    const plan = document.getElementById("setup")!;
    expect(screen.getByRole("heading", { level: 2, name: "The setup" })).toBeTruthy();
    for (const point of SETUP_POINTS) {
      expect(within(plan).getByRole("heading", { level: 3, name: new RegExp(`^${point.title}`) })).toBeTruthy();
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
    expect(within(plan).getByRole("heading", { level: 3, name: "Who uses which component In development" })).toBeTruthy();
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

    const section = document.getElementById("checklist-sources")!;
    expect(within(section).getByRole("heading", { level: 2, name: "Where the checklist comes from" })).toBeTruthy();
    const images = within(section).getAllByRole("img", { name: /Where the checklist comes from/ });
    expect(images.map((image) => image.getAttribute("data-layout"))).toEqual(["wide", "narrow"]);
    for (const image of images) {
      expect(image.querySelectorAll("[data-node]")).toHaveLength(6);
      expect(image.querySelectorAll("[data-edge]")).toHaveLength(5);
      expect(image.querySelector('[data-node="alv"]')!.textContent).toBe("Common Ground standard v1.0VNG ALV, 11 December 2026Proposed");
    }
    const sources = within(section).getByRole("list", { name: "The three sources" });
    expect(within(sources).getAllByRole("listitem")).toHaveLength(3);
    expect(within(sources).getByText("Proposed")).toBeTruthy();
    expect(within(section).getByText(NO_CONDITIONS_OF_OUR_OWN)).toBeTruthy();
    const info = within(section).getByRole("list", { name: "Shown for information only" });
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
        "MaintainedA drop starts a fix term:the maintainer must fixit in time.In development"
      );
      expect(image.querySelectorAll("[data-note]")).toHaveLength(3);
    }
  });

  it("gives the states and transitions as text", () => {
    render(<AboutPage />);

    const section = document.getElementById("common-ground-lifecycle")!;
    const states = within(section).getByRole("list", { name: "The states" });
    expect(within(states).getAllByRole("listitem")).toHaveLength(CG_STATES.length);
    expect(within(states).getByText("Proposed", { selector: "li:last-child span" })).toBeTruthy();

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
    expect(within(relation).getByText(/only a stable component can be Maintained/)).toBeTruthy();
    expect(within(relation).queryByText(/open question/)).toBeNull();
    const leaving = within(relation).getByRole("table", { name: "When a Maintained component leaves stable" });
    expect(within(leaving).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      "beta, development, conceptSuitable for Common Ground",
      "obsoleteRetired",
    ]);
    expect(within(relation).getAllByRole("row")).toHaveLength(LIFECYCLE_RELATION.length + 1 + LEAVING_STABLE.length + 1);
  });

  it("shows how a component enters the standard, as a diagram and as text", () => {
    render(<AboutPage />);

    expect(ADOPTION_STATUS).toEqual({ kind: "proposed", until: "ALV 11 Dec 2026" });
    const section = document.getElementById("adoption")!;
    expect(
      within(section).getByRole("heading", { level: 2, name: "How a component enters the standard (ALV papers) Proposed (ALV 11 Dec 2026)" })
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
