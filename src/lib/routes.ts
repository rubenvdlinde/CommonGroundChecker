/**
 * The paths of the site's pages. Components was called History and Users
 * was called Organisations; the old paths redirect to these.
 */
export const COMPONENTS_PATH = "/components";
export const USERS_PATH = "/users";
export const PROVIDERS_PATH = "/providers";
export const COMPARE_PATH = "/compare";
export const FUNCTIONALITIES_PATH = "/functionalities";
/** The static site explains here how to add a component; the server has the check form on About. */
export const ADD_COMPONENT_PATH = "/add-component";

/** The page of a component, or of one of its runs. */
export function componentHref(owner: string, repo: string, analysisId?: string): string {
  const base = `${COMPONENTS_PATH}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return analysisId === undefined ? base : `${base}/${encodeURIComponent(analysisId)}`;
}

export function userHref(slug: string): string {
  return `${USERS_PATH}/${encodeURIComponent(slug)}`;
}

export function functionalityHref(id: string): string {
  return `${FUNCTIONALITIES_PATH}/${encodeURIComponent(id)}`;
}

export function providerHref(slug: string): string {
  return `${PROVIDERS_PATH}/${encodeURIComponent(slug)}`;
}

/** The old paths and where they moved to; a path below an old path moves along with it. */
export const LEGACY_PATHS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "/history", to: COMPONENTS_PATH },
  { from: "/organisations", to: USERS_PATH },
];

/** Where an old path lives now, or null for a path that did not move. */
export function legacyRedirectTarget(path: string): string | null {
  for (const { from, to } of LEGACY_PATHS) {
    if (path === from || path === `${from}/`) return to;
    if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  }
  return null;
}
