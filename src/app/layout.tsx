import type { Metadata } from "next";
import Image from "next/image";
import SiteNav from "@/components/SiteNav";
import { NAV_LINKS } from "@/lib/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Common Ground Component Checker",
  description:
    "Automatically verify whether a software component complies with the Common Ground principles of Dutch municipalities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen flex flex-col">
        <header className="bg-cg-blue text-white shadow-md">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icons/common-ground-full-logo.svg`}
              alt="Common Ground logo"
              width={180}
              height={52}
              className="h-10 sm:h-12 w-auto shrink-0"
              priority
            />
            <div>
              <h1 className="text-lg sm:text-xl font-bold leading-tight">
                Common Ground Component Checker
              </h1>
              <p className="text-xs text-blue-200">
                Component assessment for Dutch municipalities
              </p>
            </div>
          </div>
          <SiteNav links={NAV_LINKS} />
        </header>

        <main className="flex-1">{children}</main>

        <footer className="bg-cg-blue text-blue-200 text-xs py-4">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-2">
            <span>
              Common Ground Component Checker, built for the Dutch open-source government community
            </span>
            <a
              href="https://commonground.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              commonground.nl
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
