"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Checker" },
  { href: "/history", label: "History" },
  { href: "/docs", label: "Rating guide" },
  { href: "/admin", label: "Admin" },
  { href: "/about", label: "About" },
];

/** True when the path is the link's page or one of its sub-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className="border-b border-blue-900 bg-cg-blue">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-end gap-4 py-2 text-sm">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "text-white font-semibold underline underline-offset-4"
                  : "text-white hover:text-cg-lightblue transition-colors"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
