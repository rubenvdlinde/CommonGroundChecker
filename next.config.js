const isStaticSite = process.env.NEXT_PUBLIC_DATA_SOURCE === "static";
/** A project site on GitHub Pages lives under /<repository>; set NEXT_PUBLIC_BASE_PATH to that. */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/**
 * History became Components and Organisations became Users (see
 * src/lib/routes.ts). The server redirects the old paths, query included; the
 * static export has no redirects, so it has small redirect pages instead.
 */
const LEGACY_PATHS = [
  { from: "/history", to: "/components" },
  { from: "/organisations", to: "/users" },
];

function legacyRedirects() {
  return LEGACY_PATHS.flatMap(({ from, to }) => [
    { source: from, destination: to, permanent: true },
    { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true },
  ]);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    URL: process.env.URL,
  },
  ...(isStaticSite
    ? {
        // The static site is plain files: no API routes (route.ts), no image optimiser.
        output: "export",
        pageExtensions: ["tsx"],
        images: { unoptimized: true },
        trailingSlash: true,
        ...(basePath ? { basePath } : {}),
      }
    : {
        redirects: async () => legacyRedirects(),
      }),
};

module.exports = nextConfig;
