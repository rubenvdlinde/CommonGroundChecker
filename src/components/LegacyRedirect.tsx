import Link from "next/link";

interface LegacyRedirectProps {
  /** The new path, without the base path */
  to: string;
  /** What moved, for the sentence on the page: "History is now called Components." */
  notice: string;
}

/**
 * A redirect page of the static export, which has no server redirects: a
 * meta refresh, a script that keeps the query string, and a link for when
 * neither runs.
 */
export default function LegacyRedirect({ to, notice }: LegacyRedirectProps) {
  const target = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${to}`;
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-3">
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `location.replace(${JSON.stringify(target)} + location.search + location.hash);`,
        }}
      />
      <h2 className="text-2xl font-bold text-cg-blue">This page has moved</h2>
      <p className="text-gray-700">{notice}</p>
      <p>
        <Link href={to} className="inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline">
          Go to the new page
        </Link>
      </p>
    </div>
  );
}
