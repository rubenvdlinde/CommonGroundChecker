import { COMPONENTS_PATH } from "@/lib/routes";
import { HISTORY_MOVED, renderLegacyRedirect } from "@/lib/legacyRedirect";

export default function HistoryRedirectPage() {
  return renderLegacyRedirect(COMPONENTS_PATH, HISTORY_MOVED);
}
