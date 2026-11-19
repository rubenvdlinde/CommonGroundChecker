import { pathStatusLabel, type PathStatus } from "@/lib/pathDocs";

/** The label next to a heading for a part that is not in the checker yet. */
export default function StatusBadge({ status }: { status?: PathStatus }) {
  if (!status) return null;
  return (
    <>
      {" "}
      <span className="ml-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800">
        {pathStatusLabel(status)}
      </span>
    </>
  );
}
