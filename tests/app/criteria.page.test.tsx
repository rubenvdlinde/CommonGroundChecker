/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);
vi.mock("next/navigation", () => ({ notFound }));

import CriteriaPage from "@/app/docs/criteria/page";
import CriterionDocPage, { generateStaticParams } from "@/app/docs/criteria/[id]/page";
import RatingGuidePage from "@/app/docs/page";
import { CRITERION_DOCS, CRITERIA_DOC_HREF } from "@/lib/criterionDocs";

async function renderCriterion(id: string) {
  return render(await CriterionDocPage({ params: Promise.resolve({ id }) }));
}

describe("criteria index", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("lists every criterion with a link to its page", () => {
    render(<CriteriaPage />);
    const links = new Map(
      [...document.querySelectorAll("li a")].map((link) => [link.textContent, link.getAttribute("href")])
    );
    for (const doc of CRITERION_DOCS) expect(links.get(doc.title), doc.id).toBe(`/docs/criteria/${doc.id}`);
    expect(screen.getByText(`${CRITERION_DOCS.length} of ${CRITERION_DOCS.length} criteria`)).toBeTruthy();
  });

  it("filters by level and keeps the filter in the address", () => {
    render(<CriteriaPage />);
    fireEvent.change(screen.getByLabelText("Level"), { target: { value: "informative" } });
    expect(screen.queryByRole("link", { name: "Open source licence (OSI-approved)" })).toBeNull();
    expect(screen.getByRole("link", { name: "Supported standards" })).toBeTruthy();
    expect(window.location.search).toBe("?level=informative");
  });

  it("filters by source", () => {
    render(<CriteriaPage />);
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "alv" } });
    const list = screen.getAllByRole("listitem").filter((item) => within(item).queryByRole("link"));
    expect(list.map((item) => within(item).getByRole("link").textContent)).toEqual(["Maintenance contract"]);
  });

  it("reads the filters from the address", () => {
    window.history.replaceState(null, "", "/docs/criteria?source=sig");
    render(<CriteriaPage />);
    expect((screen.getByLabelText("Source") as HTMLSelectElement).value).toBe("sig");
    expect(screen.queryByRole("link", { name: "Docker support" })).toBeNull();
  });

  it("is linked from the rating guide", () => {
    render(<RatingGuidePage />);
    expect(screen.getByRole("link", { name: "Every criterion has its own page" }).getAttribute("href")).toBe(
      CRITERIA_DOC_HREF
    );
  });
});

describe("criterion page", () => {
  afterEach(() => cleanup());

  it("has a static page for every criterion", () => {
    expect(generateStaticParams().map((param) => param.id).sort()).toEqual(CRITERION_DOCS.map((doc) => doc.id).sort());
  });

  it("shows what, why, source, level, tool, how to pass and the publiccode.yml fields", async () => {
    await renderCriterion("maintenance");
    expect(screen.getByRole("heading", { level: 1, name: "Maintenance contract" })).toBeTruthy();
    for (const name of ["What it checks", "Why it matters", "Where it comes from", "Level and version", "How it is measured", "How to pass", "publiccode.yml"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "maintenance" }).getAttribute("href")).toBe("/docs/publiccode-profile#maintenance");
    expect(screen.getByText("Introduced in 2026.1")).toBeTruthy();
  });

  it("names the transition date of a criterion that is not mandatory yet", async () => {
    await renderCriterion("artifacthub");
    expect(screen.getByText(/Becomes mandatory on 19 May 2027/)).toBeTruthy();
  });

  it("marks a criterion of an open change", async () => {
    await renderCriterion("secretscanning");
    expect(screen.getByText(/part of an open change to the checker/)).toBeTruthy();
    expect(screen.getByText("Not in a released version yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Secrets" }).getAttribute("href")).toBe("/docs/security#secrets");
  });

  it("is not found for an unknown criterion", async () => {
    await expect(renderCriterion("nope")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
