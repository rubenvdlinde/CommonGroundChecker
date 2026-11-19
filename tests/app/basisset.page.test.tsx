/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const getRepositories = vi.hoisted(() => vi.fn());
const loadBasisset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getRepositories }));
vi.mock("@/lib/basisset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/basisset")>()),
  loadBasisset,
}));

import BasissetPage from "@/app/basisset/page";
import { parseBasisset } from "@/lib/basisset";

const basisset = parseBasisset({
  version: "0.3.1",
  components: [
    { name: "OpenZaak", status: "g", basisset: true, repo: ["https://github.com/open-zaak/open-zaak"], version: "1.29.0" },
    { name: "OpenRegister", status: "g", basisset: true, repo: ["https://codeberg.org/Conduction/openregister"], version: "1.0.3" },
    { name: "OpenFormulieren", status: "g", basisset: false, repo: ["https://github.com/open-formulieren/open-forms"], version: "4.1.0" },
  ],
});

describe("BasissetPage", () => {
  afterEach(() => cleanup());

  it("lists every entry with its match in the checker, and a same-name repository at another address", async () => {
    loadBasisset.mockResolvedValue(basisset);
    getRepositories.mockResolvedValue([
      { owner: "open-zaak", name: "open-zaak", repoUrl: "https://github.com/open-zaak/open-zaak", latestAnalysis: { version: "1.31.2" } },
      { owner: "ConductionNL", name: "openregister", repoUrl: "https://github.com/ConductionNL/openregister", latestAnalysis: null },
    ]);

    render(await BasissetPage());

    expect(screen.getByRole("status").textContent).toBe("Version 0.3.1 of the list: 3 entries, 2 in the basisset and 1 next to it.");
    const rows = within(screen.getByRole("list", { name: "Basisset entries" })).getAllByRole("listitem", { hidden: false });
    const openZaak = screen.getByRole("list", { name: "In the checker for OpenZaak" });
    expect(openZaak.textContent).toContain("scanned version 1.31.2, newer than the basisset");
    expect(within(openZaak).getByRole("link", { name: "open-zaak/open-zaak" }).getAttribute("href")).toBe("/history/open-zaak/open-zaak");
    expect(screen.getByRole("list", { name: "At another address for OpenRegister" }).textContent).toContain("ConductionNL/openregister");
    expect(rows.some((row) => row.textContent?.includes("OpenFormulieren") && row.textContent.includes("Next to basisset"))).toBe(true);
    expect(getRepositories).toHaveBeenCalledWith(50);
  });

  it("says when the list cannot be read", async () => {
    loadBasisset.mockResolvedValue(null);
    getRepositories.mockRejectedValue(new Error("offline"));

    render(await BasissetPage());

    expect(screen.getByText("The basisset could not be read from code.overheid.nl just now.")).toBeTruthy();
    expect(screen.getByText(/could not be loaded, so nothing is matched/)).toBeTruthy();
  });
});
