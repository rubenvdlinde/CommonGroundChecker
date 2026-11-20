import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { FUNCTIONALITIES_PATH, PROVIDERS_PATH, USERS_PATH } from "@/lib/routes";

export type NavLink = { href: string; label: string };

/** The links both modes share, in order. Components is the home page. */
const SHARED_NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/", label: "Components" },
  { href: FUNCTIONALITIES_PATH, label: "Functionalities" },
  { href: USERS_PATH, label: "Users" },
  { href: PROVIDERS_PATH, label: "Providers" },
  { href: "/docs", label: "Rating guide" },
  { href: "/about", label: "About" },
];

/** The server has an admin; the check form lives on About. */
export const SERVER_NAV_LINKS: ReadonlyArray<NavLink> = [...SHARED_NAV_LINKS, { href: "/admin", label: "Admin" }];

/** The static site has no admin: settings change by pull request. */
export const STATIC_NAV_LINKS: ReadonlyArray<NavLink> = SHARED_NAV_LINKS;

export function navLinks(isStaticSite: boolean = IS_STATIC_SITE): ReadonlyArray<NavLink> {
  return isStaticSite ? STATIC_NAV_LINKS : SERVER_NAV_LINKS;
}

export const NAV_LINKS: ReadonlyArray<NavLink> = navLinks();

/** Whether a link is the current section: Components covers the home page and every component page. */
export function isActiveNavLink(href: string, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (href === "/") return path === "/" || path === "/components" || path.startsWith("/components/");
  return path === href || path.startsWith(`${href}/`);
}
