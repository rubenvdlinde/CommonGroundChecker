import { describe, expect, it } from "vitest";
import { SERVER_NAV_LINKS, STATIC_NAV_LINKS, isActiveNavLink, navLinks } from "@/lib/navigation";

describe("navigation", () => {
  it("lists Components, Functionalities, Users, Providers, Rating guide and About, then Admin on the server", () => {
    expect(SERVER_NAV_LINKS.map((link) => link.label)).toEqual([
      "Components",
      "Functionalities",
      "Users",
      "Providers",
      "Rating guide",
      "About",
      "Admin",
    ]);
    expect(SERVER_NAV_LINKS.map((link) => link.href)).toEqual(["/", "/functionalities", "/users", "/providers", "/docs", "/about", "/admin"]);
    expect(navLinks(false)).toBe(SERVER_NAV_LINKS);
  });

  it("never shows Admin in the static site", () => {
    expect(STATIC_NAV_LINKS.map((link) => link.label)).toEqual(["Components", "Functionalities", "Users", "Providers", "Rating guide", "About"]);
    expect(navLinks(true)).toBe(STATIC_NAV_LINKS);
  });

  it("marks Components on the home page and every component page", () => {
    expect(isActiveNavLink("/", "/")).toBe(true);
    expect(isActiveNavLink("/", "/components/")).toBe(true);
    expect(isActiveNavLink("/", "/components/org/repo")).toBe(true);
    expect(isActiveNavLink("/", "/users")).toBe(false);
    expect(isActiveNavLink("/users", "/users/utrecht/")).toBe(true);
    expect(isActiveNavLink("/docs", "/docs/criteria/license")).toBe(true);
    expect(isActiveNavLink("/about", "/about-us")).toBe(false);
  });
});
