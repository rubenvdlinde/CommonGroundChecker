/* @vitest-environment jsdom */

import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const listRepositories = vi.fn();

vi.mock("@/lib/dataSource", () => ({
  dataSource: () => ({ listRepositories }),
}));

import FunctionalitiesPage from "@/app/functionalities/page";
import FunctionalityPage from "@/app/functionalities/[id]/page";

const FIXTURES = path.resolve(__dirname, "../fixtures/functionalities");

beforeEach(() => {
  vi.stubEnv("CGC_REPOSITORIES_FILE", path.join(FIXTURES, "repositories.yml"));
  vi.stubEnv("CGC_FUNCTIONALITIES_FILE", path.join(FIXTURES, "functionalities.yml"));
  listRepositories.mockResolvedValue([
    {
      owner: "maykinmedia",
      name: "open-object",
      displayName: "Open Object",
      repoUrl: "https://github.com/maykinmedia/open-object",
      latestAnalysis: { score: 70 },
    },
    {
      owner: "ConductionNL",
      name: "openregister",
      displayName: "OpenRegister",
      repoUrl: "https://github.com/ConductionNL/openregister",
      latestAnalysis: { score: 80 },
    },
  ]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("FunctionalitiesPage", () => {
  it("counts overlap, single providers and gaps, and lists the overlap with its components", async () => {
    render(await FunctionalitiesPage());

    expect(screen.getByRole("heading", { level: 2, name: "Functionalities" })).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(summary.textContent).toContain("1provided by more than one component: candidate overlap");
    expect(summary.textContent).toContain("1provided by one component");
    expect(summary.textContent).toContain("1provided by no listed component: a gap");
    expect(screen.getByText(/2 components list functionalities now; 1 of those lists is a draft/)).toBeTruthy();

    const overlap = screen.getByRole("region", { name: "Candidate overlap" });
    expect(within(overlap).getByRole("link", { name: "Registreren en delen van basisgegevens" }).getAttribute("href")).toBe(
      "/functionalities/registreren-en-delen-van-basisgegevens"
    );
    expect(within(overlap).getByRole("link", { name: "Open Object" }).getAttribute("href")).toBe("/components/maykinmedia/open-object");
    expect(within(overlap).getByRole("link", { name: "OpenRegister" })).toBeTruthy();

    const gaps = screen.getByRole("region", { name: "Gaps" });
    expect(within(gaps).getByText("Zaakregistratiecomponent (1)")).toBeTruthy();
  });
});

describe("FunctionalityPage", () => {
  it("shows the GEMMA source, the components that provide it and a compare link per pair", async () => {
    render(await FunctionalityPage({ params: Promise.resolve({ id: "registreren-en-delen-van-basisgegevens" }) }));

    expect(screen.getByRole("heading", { level: 2, name: "Registreren en delen van basisgegevens" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Gegevensmagazijncomponent" }).getAttribute("href")).toBe(
      "https://www.gemmaonline.nl/wiki/GEMMA/id-guid-gm"
    );
    expect(screen.getByText(/2 components provide it. That is a candidate overlap/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Compare Open Object with OpenRegister" }).getAttribute("href")).toBe(
      "/compare?a=maykinmedia/open-object&b=ConductionNL/openregister"
    );
    expect(screen.getByRole("link", { name: "Show these components in the Components list" }).getAttribute("href")).toBe(
      "/components?sort=rating&direction=desc&functionality=registreren-en-delen-van-basisgegevens"
    );
  });

  it("calls a functionality without components a gap, and an unknown id not found", async () => {
    render(await FunctionalityPage({ params: Promise.resolve({ id: "registreren-en-delen-van-zaken" }) }));
    expect(screen.getByText(/That is a gap/)).toBeTruthy();
    cleanup();
    render(await FunctionalityPage({ params: Promise.resolve({ id: "teleporteren" }) }));
    expect(screen.getByRole("heading", { name: "Functionality not found" })).toBeTruthy();
  });
});
