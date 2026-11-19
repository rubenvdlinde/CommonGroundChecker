/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const permanentRedirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`redirect ${to}`);
  })
);
vi.mock("next/navigation", () => ({ permanentRedirect, redirect: permanentRedirect }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  permanentRedirect.mockClear();
});

async function pagesIn(mode: "static" | "api") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", mode);
  return {
    history: (await import("@/app/history/page")).default,
    run: (await import("@/app/history/[owner]/[repo]/[analysisId]/page")).default,
    organisation: (await import("@/app/organisations/[slug]/page")).default,
  };
}

describe("redirect pages of the static export", () => {
  it("send /history to /components with a meta refresh and a link", async () => {
    const { history } = await pagesIn("static");
    const { container } = render(history());

    expect(container.querySelector("meta[http-equiv='refresh']")?.getAttribute("content")).toBe("0; url=/components/");
    expect(container.querySelector("script")?.innerHTML).toContain('location.replace("/components/" + location.search');
    expect(screen.getByText("History is now called Components.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to the new page" }).getAttribute("href")).toBe("/components");
  });

  it("keep the component and the run of an old run page", async () => {
    const { run } = await pagesIn("static");
    render(await run({ params: Promise.resolve({ owner: "open-zaak", repo: "open-zaak", analysisId: "2026-11-19" }) }));
    expect(screen.getByRole("link", { name: "Go to the new page" }).getAttribute("href")).toBe(
      "/components/open-zaak/open-zaak/2026-11-19"
    );
  });

  it("send an organisation page to its Users page", async () => {
    const { organisation } = await pagesIn("static");
    render(await organisation({ params: Promise.resolve({ slug: "gemeente-utrecht" }) }));
    expect(screen.getByText(/Organisations is now called Users/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to the new page" }).getAttribute("href")).toBe("/users/gemeente-utrecht");
  });

  it("prefix the base path of a project site in the meta refresh", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/CommonGroundChecker");
    const { history } = await pagesIn("static");
    const { container } = render(history());
    expect(container.querySelector("meta[http-equiv='refresh']")?.getAttribute("content")).toBe(
      "0; url=/CommonGroundChecker/components/"
    );
  });
});

describe("old paths on the server", () => {
  it("redirect permanently when next.config did not already", async () => {
    const { history, organisation } = await pagesIn("api");
    expect(() => history()).toThrow("redirect /components");
    await expect(organisation({ params: Promise.resolve({ slug: "utrecht" }) })).rejects.toThrow("redirect /users/utrecht");
    expect(permanentRedirect).toHaveBeenCalledTimes(2);
  });
});
