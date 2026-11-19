import { permanentRedirect } from "next/navigation";
import LegacyRedirect from "@/components/LegacyRedirect";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";

/**
 * The page at an old path. The server redirects old paths in next.config.js
 * before a page renders, so this redirects only when that did not happen;
 * the static export renders a redirect page.
 */
export function renderLegacyRedirect(to: string, notice: string) {
  if (!IS_STATIC_SITE) permanentRedirect(to);
  return <LegacyRedirect to={to} notice={notice} />;
}

export const HISTORY_MOVED = "History is now called Components.";
export const ORGANISATIONS_MOVED = "Organisations is now called Users: the organisations that use a component.";
