import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ResponsiveNav from "@/components/ResponsiveNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Common Ground Component Checker",
  description:
    "Automatically verify whether a software component complies with the Common Ground principles of Dutch municipalities.",
};

const NAV_LINK_CLASS =
  "tap-target inline-flex items-center px-2 sm:py-2 text-white hover:text-cg-lightblue transition-colors";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen flex flex-col">
        <header className="bg-cg-blue text-white shadow-md">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
            <Image
              src="/icons/common-ground-full-logo.svg"
              alt="Common Ground logo"
              width={180}
              height={52}
              className="h-9 sm:h-12 w-auto shrink-0"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold leading-tight">
                Common Ground Component Checker
              </h1>
              <p className="text-xs text-blue-200">
                Component assessment for Dutch municipalities
              </p>
            </div>
          </div>
          <ResponsiveNav>
            <Link href="/" className={NAV_LINK_CLASS}>
              Checker
            </Link>
            <Link href="/history" className={NAV_LINK_CLASS}>
              History
            </Link>
            <Link href="/admin" className={NAV_LINK_CLASS}>
              Admin
            </Link>
            <Link href="/about" className={NAV_LINK_CLASS}>
              About
            </Link>
          </ResponsiveNav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="bg-cg-blue text-blue-200 text-xs py-4">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-2">
            <span>
              Common Ground Component Checker — built for the Dutch open-source gov
              community
            </span>
            <a
              href="https://commonground.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target inline-flex items-center self-start underline hover:text-white"
            >
              commonground.nl
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
