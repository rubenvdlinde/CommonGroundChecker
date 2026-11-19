/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/apiClient", () => ({
  getAdminScoring: vi.fn().mockRejectedValue(new Error("offline")),
  getRepositories: vi.fn().mockResolvedValue([]),
  getRepoHistory: vi.fn().mockRejectedValue(new Error("offline")),
  streamCheck: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

async function aboutPageIn(mode: "static" | "api") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", mode);
  return (await import("@/app/about/page")).default;
}

describe("AboutPage and the check form", { timeout: 30_000 }, () => {
  it("has the check form with its intro and disclaimer on the server", async () => {
    const AboutPage = await aboutPageIn("api");
    const { container } = render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Check a component" })).toBeTruthy();
    expect(container.querySelector("#check form")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "About Common Ground" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Add your component" })).toBeNull();
  });

  it("explains how to add a component in the static site, which has no form", async () => {
    const AboutPage = await aboutPageIn("static");
    const { container } = render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Add your component" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Check a component" })).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "About Common Ground" })).toBeTruthy();
  });
});
