/**
 * Where the pages read their data: the backend API (the default) or the JSON
 * files of the static site. Set NEXT_PUBLIC_DATA_SOURCE=static at build time
 * for the static export; the value is inlined, so client code can read it too.
 */
export type DataSourceKind = "api" | "static";

export function dataSourceKind(value: string | undefined = process.env.NEXT_PUBLIC_DATA_SOURCE): DataSourceKind {
  return value?.trim().toLowerCase() === "static" ? "static" : "api";
}

export const IS_STATIC_SITE = dataSourceKind() === "static";

/** The repository that holds the static site's configuration, for edit links and issue forms. */
export const SOURCE_REPOSITORY_URL = (
  process.env.NEXT_PUBLIC_SOURCE_REPOSITORY_URL || "https://github.com/Hugo-ter-Doest/CommonGroundChecker"
).replace(/\/+$/, "");

/** The branch pull requests to the component list go to. */
export const CONFIG_BRANCH = process.env.NEXT_PUBLIC_CONFIG_BRANCH || "main";

export const STATIC_SITE_LINKS = {
  componentList: `${SOURCE_REPOSITORY_URL}/blob/${CONFIG_BRANCH}/config/repositories.yml`,
  editComponentList: `${SOURCE_REPOSITORY_URL}/edit/${CONFIG_BRANCH}/config/repositories.yml`,
  slaList: `${SOURCE_REPOSITORY_URL}/blob/${CONFIG_BRANCH}/config/slas.yml`,
  requestScan: `${SOURCE_REPOSITORY_URL}/issues/new?template=request-a-scan.yml`,
};
