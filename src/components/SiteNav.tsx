"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { isActiveNavLink, type NavLink } from "@/lib/navigation";

const LINK_CLASS =
  "inline-flex items-center min-h-[44px] min-w-[44px] px-1 text-white hover:text-cg-lightblue transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * The site navigation. From the sm breakpoint the links sit in one row; on a
 * narrow screen a Menu button opens them as a list, which closes again when
 * a link is followed.
 */
export default function SiteNav({ links }: { links: ReadonlyArray<NavLink> }) {
  const pathname = usePathname() ?? "/";
  // The menu is open on the page it was opened on, so it is closed again after any navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const listId = useId();

  const items = links.map((link) => {
    const active = isActiveNavLink(link.href, pathname);
    return (
      <li key={link.href}>
        <Link
          href={link.href}
          aria-current={active ? "page" : undefined}
          className={`${LINK_CLASS} ${active ? "font-semibold underline underline-offset-4" : ""}`}
          onClick={() => setOpen(false)}
        >
          {link.label}
        </Link>
      </li>
    );
  });

  return (
    <nav aria-label="Main" className="border-b border-blue-900 bg-cg-blue">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <ul className="hidden sm:flex flex-wrap items-center justify-end gap-x-4 text-sm">{items}</ul>
        <div className="sm:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
            className="inline-flex items-center min-h-[44px] min-w-[44px] gap-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
            Menu
          </button>
          <ul id={listId} hidden={!open} className="flex flex-col pb-2 text-base">
            {items}
          </ul>
        </div>
      </div>
    </nav>
  );
}
