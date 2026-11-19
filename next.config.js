const isStaticSite = process.env.NEXT_PUBLIC_DATA_SOURCE === "static";
/** A project site on GitHub Pages lives under /<repository>; set NEXT_PUBLIC_BASE_PATH to that. */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

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
    : {}),
};

module.exports = nextConfig;
