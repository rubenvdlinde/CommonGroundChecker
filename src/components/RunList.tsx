import Link from "next/link";
import EndorsementChip from "@/components/EndorsementChip";
import RatingBadge from "@/components/RatingBadge";
import type { RunSummary } from "@/lib/repositoryRun";

interface RunListProps {
  /** Runs, newest first */
  runs: RunSummary[];
  /** The run the page shows; it is marked as the current page */
  selectedId: string | null;
  analysisHref: (analysisId: string) => string;
}

function IssueCount({ count, className }: { count: number | null; className: string }) {
  if (count === null) {
    return (
      <>
        <span aria-hidden="true">–</span>
        <span className="sr-only">not stored</span>
      </>
    );
  }
  return <span className={count > 0 ? `font-semibold ${className}` : "text-gray-600"}>{count}</span>;
}

const LINK_CLASS =
  "text-cg-lightblue hover:underline rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cg-blue";

/** Every stored run of a repository: date, rating, pass or fail and its errors and warnings, each linking to its run. */
export default function RunList({ runs, selectedId, analysisHref }: RunListProps) {
  if (runs.length === 0) {
    return <p className="text-sm text-gray-500">No runs stored yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">All runs of this repository, newest first</caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
            <th scope="col" className="py-2 pr-4 font-semibold">Run</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Rating</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Result</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Errors</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Warnings</th>
            <th scope="col" className="py-2 font-semibold">Version</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, index) => {
            const isSelected = run.id === selectedId;
            return (
              <tr
                key={run.id}
                className={`border-b border-gray-100 last:border-0 ${isSelected ? "bg-blue-50" : ""}`}
              >
                <th scope="row" className="py-2 pr-4 text-left font-normal whitespace-nowrap">
                  <Link
                    href={analysisHref(run.id)}
                    aria-current={isSelected ? "page" : undefined}
                    className={`${LINK_CLASS} ${isSelected ? "font-semibold text-cg-blue" : ""}`}
                  >
                    {new Date(run.checkedAt).toLocaleString("nl-NL")}
                  </Link>
                  {index === 0 && (
                    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-300 text-gray-700 bg-white">
                      Latest
                    </span>
                  )}
                  {isSelected && (
                    <span aria-hidden="true" className="ml-2 text-xs font-semibold text-cg-blue">
                      Shown above
                    </span>
                  )}
                </th>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <RatingBadge rating={run.rating} />
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <EndorsementChip endorsement={{ passed: run.passed, reasons: [] }} />
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <IssueCount count={run.errors} className="text-red-700" />
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <IssueCount count={run.warnings} className="text-amber-800" />
                </td>
                <td className="py-2 whitespace-nowrap text-xs text-purple-700">{run.version ?? "unknown"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
