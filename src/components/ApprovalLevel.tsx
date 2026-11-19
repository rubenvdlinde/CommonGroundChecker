import type { Approval } from "@/lib/approval";
import type { Endorsement } from "@/lib/types";

interface ApprovalLevelProps {
  approval: Approval;
  endorsement: Endorsement;
  minConfirmedUsers: number;
}

function LevelRow({
  title,
  reached,
  detail,
  reasons,
  reasonsLabel,
}: {
  title: string;
  reached: boolean;
  detail: string;
  reasons: string[];
  reasonsLabel: string;
}) {
  return (
    <li className={`rounded-xl border px-4 py-3 ${reached ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span
          className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${
            reached ? "border-green-300 text-green-700 bg-white" : "border-gray-300 text-gray-600 bg-gray-50"
          }`}
        >
          {reached ? "Reached" : "Not reached"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{detail}</p>
      {!reached && reasons.length > 0 && (
        <ul aria-label={reasonsLabel} className="mt-2 list-disc pl-5 text-xs text-red-700 space-y-0.5">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** The two levels, Approved above Suitable for Common Ground, with the reasons a level is not reached. */
export default function ApprovalLevel({ approval, endorsement, minConfirmedUsers }: ApprovalLevelProps) {
  return (
    <ol aria-label="Levels" className="space-y-2">
      <LevelRow
        title="Approved"
        reached={approval.approved}
        detail={`Suitable for Common Ground, stable, used by at least ${minConfirmedUsers} confirmed organisations and maintained under a valid SLA.${
          approval.sla ? ` SLA: ${approval.sla.party} with ${approval.sla.maintainer}, until ${approval.sla.until}.` : ""
        }`}
        reasons={approval.reasons}
        reasonsLabel="Why it is not approved"
      />
      <LevelRow
        title="Suitable for Common Ground"
        reached={endorsement.passed}
        detail="The checker finds that the component meets the technical conditions. Advice to buyers, not a condition to be listed."
        reasons={endorsement.reasons}
        reasonsLabel="Why it is not yet suitable"
      />
    </ol>
  );
}
