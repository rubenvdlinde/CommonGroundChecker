import { LIFECYCLE_LABELS, type LifecycleStatus } from "@/lib/lifecycle";

const CHIP_CLASSES: Record<LifecycleStatus, string> = {
  listed: "border-gray-300 text-gray-700 bg-gray-50",
  measured: "border-amber-300 text-amber-900 bg-amber-50",
  suitable: "border-green-300 text-green-800 bg-green-50",
  maintained: "border-cg-blue text-white bg-cg-blue",
  retired: "border-gray-500 text-gray-800 bg-gray-200",
};

/** The Common Ground status of a component as a chip. */
export default function LifecycleChip({ status }: { status: LifecycleStatus }) {
  return (
    <span
      className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${CHIP_CLASSES[status]}`}
      data-lifecycle-status={status}
    >
      {LIFECYCLE_LABELS[status]}
    </span>
  );
}

/** The basisset as a chip, next to the status. Information only. */
export function BasissetChip({ inBasisset }: { inBasisset: boolean }) {
  return (
    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-300 text-sky-900 bg-sky-50">
      {inBasisset ? "In basisset" : "Next to basisset"}
    </span>
  );
}
