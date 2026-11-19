import { IS_STATIC_SITE } from "@/lib/dataSource/mode";

type NavLink = { href: string; label: string };

/** The links of the site navigation, in order. */
export const SERVER_NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/", label: "Checker" },
  { href: "/history", label: "History" },
  { href: "/organisations", label: "Organisations" },
  { href: "/docs", label: "Rating guide" },
  { href: "/admin", label: "Admin" },
  { href: "/about", label: "About" },
];

/** The static site has no checker form and no admin: the home page explains how to add a component. */
export const STATIC_NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/history", label: "History" },
  { href: "/organisations", label: "Organisations" },
  { href: "/", label: "Add your component" },
  { href: "/docs", label: "Rating guide" },
  { href: "/about", label: "About" },
];

export const NAV_LINKS: ReadonlyArray<NavLink> = IS_STATIC_SITE ? STATIC_NAV_LINKS : SERVER_NAV_LINKS;
