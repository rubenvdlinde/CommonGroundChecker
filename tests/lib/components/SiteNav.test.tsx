/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import SiteNav from "@/components/SiteNav";
import { SERVER_NAV_LINKS, STATIC_NAV_LINKS } from "@/lib/navigation";

afterEach(cleanup);

function menuList(): HTMLElement {
  const button = screen.getByRole("button", { name: /Menu/ });
  return document.getElementById(button.getAttribute("aria-controls")!)!;
}

describe("SiteNav", () => {
  it("shows the links in order with the current section marked", () => {
    pathname.current = "/components/org/repo";
    render(<SiteNav links={SERVER_NAV_LINKS} />);
    const row = within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("list")[0];
    const links = within(row).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Components", "Functionalities", "Users", "Providers", "Rating guide", "About", "Admin"]);
    expect(links.filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.textContent)).toEqual([
      "Components",
    ]);
  });

  it("has no Admin link with the static links", () => {
    pathname.current = "/";
    render(<SiteNav links={STATIC_NAV_LINKS} />);
    expect(screen.queryAllByRole("link", { name: "Admin" })).toHaveLength(0);
  });

  it("opens and closes the menu on a narrow screen, and closes it when a link is followed", () => {
    pathname.current = "/";
    render(<SiteNav links={STATIC_NAV_LINKS} />);
    const button = screen.getByRole("button", { name: /Menu/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(menuList().hidden).toBe(true);

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(menuList().hidden).toBe(false);
    expect(within(menuList()).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Components",
      "Functionalities",
      "Users",
      "Providers",
      "Rating guide",
      "About",
    ]);

    fireEvent.click(within(menuList()).getByRole("link", { name: "Users" }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the menu after any navigation, also with the back button", () => {
    pathname.current = "/";
    const { rerender } = render(<SiteNav links={STATIC_NAV_LINKS} />);
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    expect(menuList().hidden).toBe(false);

    pathname.current = "/about";
    rerender(<SiteNav links={STATIC_NAV_LINKS} />);
    expect(menuList().hidden).toBe(true);
  });

  it("gives every link and the menu button a target of at least 44 pixels", () => {
    pathname.current = "/";
    render(<SiteNav links={SERVER_NAV_LINKS} />);
    for (const element of [...screen.getAllByRole("link", { hidden: true }), screen.getByRole("button", { name: /Menu/ })]) {
      expect(element.className).toContain("min-h-[44px]");
      expect(element.className).toContain("min-w-[44px]");
    }
  });
});
