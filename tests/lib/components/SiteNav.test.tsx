/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const usePathname = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname }));

import SiteNav, { isActivePath } from "@/components/SiteNav";

describe("SiteNav", () => {
  afterEach(() => cleanup());

  it("marks the section of a nested page as the current page", () => {
    usePathname.mockReturnValue("/history/org/repo/analysis-1");
    render(<SiteNav />);

    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "History" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Checker" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks the checker only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/history", "/")).toBe(false);
    expect(isActivePath("/admin", "/admin")).toBe(true);
    expect(isActivePath("/administrator", "/admin")).toBe(false);
  });
});
