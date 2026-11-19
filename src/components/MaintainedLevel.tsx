import { organisationsLabel, type MaintainedLevelResult } from "@/lib/maintained";
import type { Endorsement } from "@/lib/types";

interface MaintainedLevelProps {
  level: MaintainedLevelResult;
  endorsement: Endorsement;
  minUsers: number;
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

/** The two levels, Maintained above Suitable for Common Ground, with the reasons a level is not reached. */
export default function MaintainedLevel({ level, endorsement, minUsers }: MaintainedLevelProps) {
  return (
    <ol aria-label="Levels" className="space-y-2">
      <LevelRow
        title="Maintained"
        reached={level.maintained}
        detail={`Suitable for Common Ground, stable, used by at least ${organisationsLabel(minUsers)} declared in publiccode.yml, and a valid SLA with a maintainer, on the VNG model contract.${
          level.sla ? ` SLA: ${level.sla.party} with ${level.sla.maintainer}, until ${level.sla.until}.` : ""
        }`}
        reasons={level.reasons}
        reasonsLabel="Why it is not yet Maintained"
      />
      <LevelRow
        title="Suitable for Common Ground"
        reached={endorsement.passed}
        detail="The checker finds that the component meets the technical conditions. This is the threshold the Common Ground programme uses to decide whether to adopt a component as supported. It is not a condition for being listed."
        reasons={endorsement.reasons}
        reasonsLabel="Why it is not yet suitable"
      />
    </ol>
  );
}
