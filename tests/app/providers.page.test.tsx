/* @vitest-environment jsdom */

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import ProvidersPage from "@/app/providers/page";
import ProviderPage, { generateStaticParams } from "@/app/providers/[slug]/page";

const FIXTURES = path.resolve(__dirname, "../fixtures/providers");

function useList(file: string) {
  vi.stubEnv("CGC_REPOSITORIES_FILE", path.join(FIXTURES, file));
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("ProvidersPage", () => {
  it("explains how a provider adds itself by pull request while none is listed", async () => {
    useList("empty.yml");
    render(await ProvidersPage());

    expect(screen.getByRole("heading", { level: 2, name: "Providers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No providers listed yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "config/repositories.yml" }).getAttribute("href")).toMatch(
      /\/edit\/[^/]+\/config\/repositories\.yml$/
    );
    expect(screen.getByRole("link", { name: "pull request template" }).getAttribute("href")).toMatch(
      /\.github\/PULL_REQUEST_TEMPLATE\/add-component\.md$/
    );
    expect(screen.getByRole("link", { name: "Read how the providers field works" }).getAttribute("href")).toBe(
      "/docs/run-without-a-server#providers"
    );
    expect(screen.queryByRole("list", { name: "Providers" })).toBeNull();
  });

  it("lists every provider with its number of components and its services", async () => {
    useList("repositories.yml");
    render(await ProvidersPage());

    const links = within(screen.getByRole("list", { name: "Providers" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/providers/example-training", "/providers/maykin-media"]);
    expect(links[1].textContent).toContain("2 components: maintenance, support, hosting");
    expect(links[0].textContent).toContain("1 component: training");
  });
});

describe("ProviderPage", () => {
  it("builds a page for every provider in the component list", async () => {
    useList("repositories.yml");
    expect(await generateStaticParams()).toEqual([{ slug: "example-training" }, { slug: "maykin-media" }]);
    useList("empty.yml");
    expect(await generateStaticParams()).toEqual([]);
  });

  it("shows the provider's services, website, contact and date, and the components it serves", async () => {
    useList("repositories.yml");
    render(await ProviderPage({ params: Promise.resolve({ slug: "maykin-media" }) }));

    expect(screen.getByRole("heading", { level: 2, name: "Maykin Media" })).toBeTruthy();
    const services = within(screen.getByRole("list", { name: "Services of Maykin Media" })).getAllByRole("listitem");
    expect(services.map((item) => item.textContent)).toEqual(["Maintenance", "Support", "Hosting"]);
    expect(screen.getByRole("link", { name: "https://www.maykinmedia.nl" }).getAttribute("href")).toBe("https://www.maykinmedia.nl");
    expect(screen.getByRole("link", { name: "info@maykinmedia.nl" }).getAttribute("href")).toBe("mailto:info@maykinmedia.nl");
    expect(screen.getByText("2020-06-15")).toBeTruthy();

    const components = within(screen.getByRole("list", { name: "Components" }));
    expect(components.getByRole("link", { name: "open-zaak/open-zaak" }).getAttribute("href")).toBe("/components/open-zaak/open-zaak");
    const notificaties = within(screen.getByRole("list", { name: "Services for open-zaak/open-notificaties" }));
    expect(notificaties.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Maintenance", "Support"]);
    expect(screen.getByRole("link", { name: "← All providers" }).getAttribute("href")).toBe("/providers");
  });

  it("says so for a provider that is not in the list", async () => {
    useList("repositories.yml");
    render(await ProviderPage({ params: Promise.resolve({ slug: "nobody" }) }));
    expect(screen.getByText("No component in the component list names a provider with the address nobody.")).toBeTruthy();
  });
});
