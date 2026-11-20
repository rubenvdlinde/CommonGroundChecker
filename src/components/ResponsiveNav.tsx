"use client";

import { Menu, X } from "lucide-react";
import { useId, useRef, useState } from "react";

/**
 * Main navigation bar. On small screens the links collapse behind a menu
 * button; from the `sm` breakpoint up they show in one row.
 */
export default function ResponsiveNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <nav aria-label="Main" className="border-b border-blue-900 bg-cg-blue">
      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 text-sm"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            buttonRef.current?.focus();
          }
        }}
      >
        <div className="flex justify-end sm:hidden">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className="tap-target inline-flex items-center gap-2 px-2 text-white"
          >
            {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            Menu
          </button>
        </div>
        <div
          id={listId}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className={`${open ? "flex" : "hidden"} flex-col pb-2 sm:flex sm:flex-row sm:flex-wrap sm:-mr-2 sm:items-center sm:justify-end sm:pb-0`}
        >
          {children}
        </div>
      </div>
    </nav>
  );
}
