import { USERS_PATH } from "@/lib/routes";
import { ORGANISATIONS_MOVED, renderLegacyRedirect } from "@/lib/legacyRedirect";

export default function OrganisationsRedirectPage() {
  return renderLegacyRedirect(USERS_PATH, ORGANISATIONS_MOVED);
}
