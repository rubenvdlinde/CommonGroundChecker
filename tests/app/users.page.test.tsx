/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const getOrganisations = vi.hoisted(() => vi.fn());
const getOrganisation = vi.hoisted(() => vi.fn());
const getAdminScoring = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ getOrganisations, getOrganisation, getAdminScoring }));

import OrganisationsPage from "@/app/users/page";
import OrganisationPage from "@/app/users/[slug]/page";

const SOURCE_NOTE = /comes from what components declare under usedBy in their publiccode.yml, not from the organisations/;

describe("OrganisationsPage", () => {
  afterEach(() => cleanup());

  it("lists organisations by name with their number of components and a link to each", async () => {
    getOrganisations.mockResolvedValue({
      organisations: [
        { name: "Buren", slug: "buren", componentCount: 1 },
        { name: "Utrecht", slug: "utrecht", componentCount: 3 },
      ],
      nearDuplicates: [],
    });

    render(await OrganisationsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 2, name: "Users" })).toBeTruthy();
    expect(screen.getByText(/The organisations that use a component, as the component declares under usedBy/)).toBeTruthy();
    const list = screen.getByRole("list", { name: "Users" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/users/buren", "/users/utrecht"]);
    expect(links[0].textContent).toContain("1 component");
    expect(links[1].textContent).toContain("3 components");
    expect(screen.getByText(SOURCE_NOTE)).toBeTruthy();
    expect(screen.getByText("2 organisations")).toBeTruthy();
  });

  it("filters as you type, starting from the query in the address", async () => {
    getOrganisations.mockResolvedValue({
      organisations: [
        { name: "Buren", slug: "buren", componentCount: 1 },
        { name: "Utrecht", slug: "utrecht", componentCount: 3 },
      ],
      nearDuplicates: [],
    });

    render(await OrganisationsPage({ searchParams: Promise.resolve({ q: "bur" }) }));

    expect(within(screen.getByRole("list", { name: "Users" })).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("1 of 2 organisations")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "rotterdam" } });
    expect(screen.getByText("No organisation matches this search.")).toBeTruthy();
  });

  it("says so when the backend cannot be reached or nothing is declared", async () => {
    getOrganisations.mockRejectedValueOnce(new Error("offline"));
    render(await OrganisationsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("The organisations could not be loaded from the backend.")).toBeTruthy();
    cleanup();

    getOrganisations.mockResolvedValueOnce({ organisations: [], nearDuplicates: [] });
    render(await OrganisationsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("No followed component declares any users yet.")).toBeTruthy();
  });
});

const stableResults = [{ id: "publiccode", status: "pass", requirementLevel: "mandatory", publiccode: { developmentStatus: "stable" } }];

describe("OrganisationPage", () => {
  afterEach(() => cleanup());

  it("lists the components with rating, suitable and Maintained status, version and a link", async () => {
    getAdminScoring.mockRejectedValue(new Error("offline"));
    getOrganisation.mockResolvedValue({
      organisation: { name: "Utrecht", slug: "utrecht", spellings: ["Utrecht", "utrecht"], componentCount: 2 },
      components: [
        {
          repoId: "of",
          owner: "open-formulieren",
          name: "open-forms",
          repoUrl: "https://github.com/open-formulieren/open-forms",
          slas: [{ id: "s1", party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2999-12-31", link: null }],
          latestAnalysis: {
            id: "a1",
            checkedAt: "2026-11-19T10:00:00Z",
            version: "3.0.0",
            scannedRef: "3.0.0",
            scannedRefKind: "declared-version",
            declaredUserCount: 4,
            score: 90,
            rating: 4.2,
            categoryRatings: {},
            aspectRatings: {},
            endorsement: { passed: true, reasons: [] },
            results: stableResults,
          },
        },
        {
          repoId: "oz",
          owner: "open-zaak",
          name: "open-zaak",
          repoUrl: "https://github.com/open-zaak/open-zaak",
          slas: [],
          latestAnalysis: {
            id: "a2",
            checkedAt: "2026-11-19T10:00:00Z",
            version: null,
            scannedRef: "main",
            scannedRefKind: "default-branch",
            declaredUserCount: 8,
            score: 60,
            rating: 2.5,
            categoryRatings: {},
            aspectRatings: {},
            endorsement: { passed: false, reasons: ["Maintainability below 3 stars"] },
            results: stableResults,
          },
        },
      ],
    });

    render(await OrganisationPage({ params: Promise.resolve({ slug: "utrecht" }) }));

    expect(getOrganisation).toHaveBeenCalledWith("utrecht");
    expect(screen.getByRole("heading", { name: "Utrecht" })).toBeTruthy();
    expect(screen.getByText("Uses 2 components, sorted by name.")).toBeTruthy();
    expect(screen.getByText("Also written as: utrecht.")).toBeTruthy();
    expect(screen.getByText(SOURCE_NOTE)).toBeTruthy();

    const rows = within(screen.getByRole("list", { name: "Components" })).getAllByRole("listitem");
    expect(within(rows[0]).getByRole("link", { name: "open-formulieren/open-forms" }).getAttribute("href")).toBe(
      "/components/open-formulieren/open-forms"
    );
    expect(within(rows[0]).getByRole("img", { name: "Overall rating 4.2 of 5.5, 4 stars" })).toBeTruthy();
    expect(rows[0].textContent).toContain("Suitable for Common Ground");
    expect(rows[0].querySelector("[data-lifecycle-status]")?.textContent).toBe("Maintained");
    expect(rows[0].textContent).toContain("Scanned version: 3.0.0");
    expect(rows[1].textContent).toContain("Not yet suitable for Common Ground");
    expect(rows[1].querySelector("[data-lifecycle-status]")?.textContent).toBe("Measured");
    expect(rows[1].textContent).toContain("Scanned version: main");
  });

  it("says when no followed component declares the organisation", async () => {
    getOrganisation.mockResolvedValue(null);

    render(await OrganisationPage({ params: Promise.resolve({ slug: "nowhere" }) }));

    expect(screen.getByText("No followed component declares an organisation with the address nowhere.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "← All users" }).getAttribute("href")).toBe("/users");
  });

  it("says when the backend cannot be reached", async () => {
    getOrganisation.mockRejectedValue(new Error("offline"));

    render(await OrganisationPage({ params: Promise.resolve({ slug: "utrecht" }) }));

    expect(screen.getByText("The organisation could not be loaded from the backend.")).toBeTruthy();
  });
});
