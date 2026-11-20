/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import Link from "next/link";

import ResponsiveNav from "@/components/ResponsiveNav";

function renderNav() {
  return render(
    <ResponsiveNav>
      <Link href="/">Checker</Link>
      <Link href="/history">History</Link>
    </ResponsiveNav>
  );
}

describe("ResponsiveNav", () => {
  afterEach(() => {
    cleanup();
  });

  it("labels the navigation landmark", () => {
    renderNav();

    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  });

  it("starts collapsed, with a menu button that controls the link list", () => {
    renderNav();

    const button = screen.getByRole("button", { name: "Menu" });
    const list = document.getElementById(button.getAttribute("aria-controls") ?? "");

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(list).not.toBeNull();
    expect(list?.contains(screen.getByRole("link", { name: "Checker" }))).toBe(true);
    expect(list?.className).toContain("hidden");
    expect(list?.className).toContain("sm:flex");
  });

  it("opens and closes the menu with the button", () => {
    renderNav();

    const button = screen.getByRole("button", { name: "Menu" });
    const list = document.getElementById(button.getAttribute("aria-controls") ?? "");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(list?.className.split(" ")).toContain("flex");
    expect(list?.className.split(" ")).not.toContain("hidden");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the menu on Escape and returns focus to the button", () => {
    renderNav();

    const button = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(button);
    const link = screen.getByRole("link", { name: "History" });
    link.focus();

    fireEvent.keyDown(link, { key: "Escape" });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes the menu when a link is chosen", () => {
    renderNav();

    const button = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("link", { name: "History" }));

    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
