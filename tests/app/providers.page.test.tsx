/* @vitest-environment jsdom */

import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const listRepositories = vi.fn();

vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/dataSource", () => ({
  dataSource: () => ({ listRepositories }),
}));

vi.mock("@/lib/basisset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/basisset")>()),
  loadBasisset: vi.fn().mockResolvedValue(null),
}));

import ProvidersPage from "@/app/providers/page";
import ProviderPage from "@/app/providers/[slug]/page";

const FIXTURES = path.resolve(__dirname, "../fixtures/providers");
const GITLAB_SLUG = "gitlab--digilab-overheid-nl--ecosystem--ftv";

function useList(file: string) {
  vi.stubEnv("CGC_REPOSITORIES_FILE", path.join(FIXTURES, file));
}

function repository(owner: string, name: string, rating: number, displayName: string | null = null) {
  return {
    id: `${owner}/${name}`,
    owner,
    name,
    displayName,
    repoUrl: `https://github.com/${owner}/${name}`,
    latestAnalysis: { checkedAt: "2026-11-01T00:00:00Z", score: 70, rating },
  };
}

beforeEach(() => {
  listRepositories.mockResolvedValue([
    repository("open-zaak", "open-zaak", 4.2, "Open Zaak"),
    repository("open-zaak", "open-notificaties", 3.6),
    repository("ConductionNL", "opencatalogi", 3.1, "OpenCatalogi"),
  ]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ avatar_url: "https://gitlab.com/uploads/ftv.png" })))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ProvidersPage", () => {
  it("lists every repository owner, most components first, with host, count, best rating and status", async () => {
    useList("repositories.yml");
    render(await ProvidersPage());

    expect(screen.getByText(/A provider is the organisation or person that hosts a component/)).toBeTruthy();
    expect(screen.queryByText(/pull request/)).toBeNull();
    const items = within(screen.getByRole("list", { name: "Providers" })).getAllByRole("listitem", { name: undefined });
    const owners = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/providers/"));
    expect(owners.map((link) => link.getAttribute("href"))).toEqual([
      "/providers/open-zaak",
      "/providers/conductionnl",
      `/providers/${GITLAB_SLUG}`,
    ]);
    expect(items.length).toBeGreaterThan(3);
    expect(screen.getByText("GitHub, 2 components")).toBeTruthy();
    expect(screen.getByText("GitLab, 1 component")).toBeTruthy();
    expect(screen.getByLabelText("Best rating 4.2 of 5.5, 4 stars")).toBeTruthy();

    const openZaak = within(screen.getByRole("list", { name: "Components of open-zaak" }));
    expect(openZaak.getByRole("link", { name: "Open Zaak" }).getAttribute("href")).toBe("/components/open-zaak/open-zaak");
    const ftv = within(screen.getByRole("list", { name: "Components of digilab.overheid.nl/ecosystem/ftv" }));
    expect(ftv.queryByRole("link")).toBeNull();
    expect(ftv.getByText("digilab.overheid.nl/ecosystem/ftv/open-ftv")).toBeTruthy();
  });

  it("shows how to add a component while the list is empty", async () => {
    useList("empty.yml");
    listRepositories.mockResolvedValue([]);
    render(await ProvidersPage());

    expect(screen.getByRole("heading", { name: "No components yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add a component" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Providers" })).toBeNull();
  });

  it("still lists the owners of the component list when the data cannot be read", async () => {
    useList("repositories.yml");
    listRepositories.mockRejectedValue(new Error("down"));
    render(await ProvidersPage());
    expect(within(screen.getByRole("list", { name: "Providers" })).getByRole("link", { name: "open-zaak" })).toBeTruthy();
  });
});

describe("ProviderPage", () => {
  it("builds a page for every owner in a static export, and a placeholder without one", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "static");
    vi.resetModules();
    useList("repositories.yml");
    const staticPage = await import("@/app/providers/[slug]/page");
    expect(await staticPage.generateStaticParams!()).toEqual([
      { slug: "open-zaak" },
      { slug: "conductionnl" },
      { slug: GITLAB_SLUG },
    ]);
    useList("empty.yml");
    listRepositories.mockResolvedValue([]);
    expect(await staticPage.generateStaticParams!()).toEqual([{ slug: staticPage.NO_PROVIDER_SLUG }]);
  });

  it("renders on request on the server", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "");
    vi.resetModules();
    expect((await import("@/app/providers/[slug]/page")).generateStaticParams).toBeUndefined();
  });

  it("shows the owner's components with rating and status, what it also offers, and pairs to compare", async () => {
    useList("repositories.yml");
    render(await ProviderPage({ params: Promise.resolve({ slug: "open-zaak" }) }));

    expect(screen.getByRole("heading", { level: 2, name: "open-zaak" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "open-zaak on GitHub" }).getAttribute("href")).toBe("https://github.com/open-zaak");
    const services = within(screen.getByRole("list", { name: "Services of open-zaak" })).getAllByRole("listitem");
    expect(services.map((item) => item.textContent)).toEqual(["Support"]);
    expect(screen.getByText("Also offers: support")).toBeTruthy();

    const components = within(screen.getByRole("list", { name: "Components" }));
    expect(components.getByRole("link", { name: "Open Zaak" }).getAttribute("href")).toBe("/components/open-zaak/open-zaak");
    expect(components.getByLabelText("Overall rating 4.2 of 5.5, 4 stars")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Zaak and open-zaak/open-notificaties" }).getAttribute("href")).toBe(
      "/compare?a=open-zaak/open-zaak&b=open-zaak/open-notificaties"
    );
    expect(screen.getByRole("link", { name: "← All providers" }).getAttribute("href")).toBe("/providers");
  });

  it("shows a nested GitLab group with its avatar and a component that is not rated yet", async () => {
    useList("repositories.yml");
    const { container } = render(await ProviderPage({ params: Promise.resolve({ slug: GITLAB_SLUG }) }));

    expect(screen.getByRole("heading", { level: 2, name: "digilab.overheid.nl/ecosystem/ftv" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "digilab.overheid.nl/ecosystem/ftv on GitLab" }).getAttribute("href")).toBe(
      "https://gitlab.com/digilab.overheid.nl/ecosystem/ftv"
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://gitlab.com/uploads/ftv.png");
    expect(screen.getByText("Not rated yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Compare" })).toBeNull();
  });

  it("says so for an owner that is not in the list", async () => {
    useList("repositories.yml");
    render(await ProviderPage({ params: Promise.resolve({ slug: "nobody" }) }));
    expect(screen.getByText("No component on the list has a provider with the address nobody.")).toBeTruthy();
  });
});
