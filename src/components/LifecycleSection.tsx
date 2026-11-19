import BasissetNote from "@/components/BasissetNote";
import LifecycleChip from "@/components/LifecycleChip";
import RetireControl from "@/components/RetireControl";
import type { BasissetMatch } from "@/lib/basisset";
import { formatLifecycleDate, LIFECYCLE_LABELS, LIFECYCLE_STATUSES, type LifecycleResult } from "@/lib/lifecycle";

export interface RepositoryLifecycle {
  result: LifecycleResult;
  basisset: BasissetMatch;
  scannedVersion: string | null;
  retiredAt: string | null;
  /** Shows the admin retire control; off on a static site, which has no backend */
  adminControls: boolean;
}

interface LifecycleSectionProps extends RepositoryLifecycle {
  repoId: string;
}

/** The status one up from a status, for "What is missing for ..."; none above Maintained or for Retired. */
function nextStatusLabel(result: LifecycleResult): string | null {
  if (result.status === "retired" || result.status === "maintained") return null;
  const next = LIFECYCLE_STATUSES[LIFECYCLE_STATUSES.indexOf(result.status) + 1];
  return LIFECYCLE_LABELS[next];
}

/** The Common Ground status of a component, why it is not at the next status, and what the basisset says about it. */
export default function LifecycleSection({
  repoId,
  result,
  basisset,
  scannedVersion,
  retiredAt,
  adminControls,
}: LifecycleSectionProps) {
  const next = nextStatusLabel(result);
  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 id="lifecycle-heading" className="text-lg font-semibold text-gray-800">
          Common Ground status
        </h3>
        <LifecycleChip status={result.status} />
      </div>
      {result.note && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">{result.note}</p>
      )}
      {result.status === "retired" && (
        <p className="text-sm text-gray-700">
          {result.retiredBy === "admin"
            ? `Retired by an admin${retiredAt ? ` on ${formatLifecycleDate(retiredAt)}` : ""}: ${result.retiredReason ?? "no reason given"}.`
            : "Retired: the scanned publiccode.yml says developmentStatus: obsolete."}{" "}
          The history stays. It is not rescanned.
        </p>
      )}
      {next && result.reasons.length > 0 && (
        <ul aria-label={`What is missing for ${next}`} className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
          {result.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-gray-800">Common Ground basisset</h4>
        <BasissetNote match={basisset} scannedVersion={scannedVersion} />
      </div>
      {adminControls && (
        <RetireControl
          repoId={repoId}
          initialRetired={result.retiredBy === "admin"}
          initialReason={result.retiredBy === "admin" ? result.retiredReason : null}
        />
      )}
    </section>
  );
}
