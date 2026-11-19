import type { SlaCategorySummary, SlaSummary, SlaTimes } from "@/lib/types";

const LINK_CLASS =
  "text-cg-lightblue underline hover:text-cg-blue rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cg-blue";

function days(value: number): string {
  return `${value} ${value === 1 ? "day" : "days"}`;
}

function termText(term: number | "next-release" | null): string {
  if (term === null) return "no term";
  return term === "next-release" ? "next release" : days(term);
}

function TimesCell({ times }: { times: SlaTimes | null }) {
  if (!times) return <span className="text-gray-500">not measured</span>;
  return (
    <span className="flex flex-col">
      <span>
        {times.median === null ? "none measured" : `median ${days(times.median)}`}
        {times.worst !== null && `, worst ${days(times.worst)}`}
      </span>
      {times.waiting > 0 && <span className="text-gray-600">{times.waiting} still waiting</span>}
    </span>
  );
}

function BreachCell({ times }: { times: SlaTimes | null }) {
  if (!times) return <span className="text-gray-500">-</span>;
  return (
    <span className={times.breaches > 0 ? "font-semibold text-amber-900" : "text-gray-700"}>{times.breaches}</span>
  );
}

function Row({ row }: { row: SlaCategorySummary }) {
  return (
    <tr className="border-t border-gray-100 align-top">
      <th scope="row" className="px-2 py-1 font-normal text-gray-800">
        {row.label}
      </th>
      <td className="px-2 py-1 text-gray-700 whitespace-nowrap">
        respond {termText(row.respondDays)}, fix {termText(row.fixDays)}
      </td>
      <td className="px-2 py-1 text-gray-900">{row.count}</td>
      <td className="px-2 py-1 text-gray-700">
        <TimesCell times={row.response} />
      </td>
      <td className="px-2 py-1">
        <BreachCell times={row.response} />
      </td>
      <td className="px-2 py-1 text-gray-700">
        {row.fixDays === null ? <span className="text-gray-500">no fix term</span> : <TimesCell times={row.fix} />}
      </td>
      <td className="px-2 py-1">{row.fixDays === null ? <span className="text-gray-500">-</span> : <BreachCell times={row.fix} />}</td>
    </tr>
  );
}

/**
 * Issue response and fix times per category against the proposed SLA terms,
 * with the open issues past their due date. Informative: no stars, not in
 * the verdict.
 */
export default function SlaTable({ sla }: { sla: SlaSummary }) {
  if (sla.notMeasured !== null) {
    return <p className="text-xs text-gray-600">Issue response and fix times: not measured, {sla.notMeasured}.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-left border border-gray-200">
          <caption className="text-left text-gray-600 pb-1">
            Issue response and fix times from {sla.from} to {sla.to}, in working days, against proposed SLA terms
          </caption>
          <thead className="bg-cg-gray">
            <tr>
              <th scope="col" className="px-2 py-1">Category</th>
              <th scope="col" className="px-2 py-1">Terms (proposal)</th>
              <th scope="col" className="px-2 py-1">Issues</th>
              <th scope="col" className="px-2 py-1">Response</th>
              <th scope="col" className="px-2 py-1">Late responses</th>
              <th scope="col" className="px-2 py-1">Fix</th>
              <th scope="col" className="px-2 py-1">Late fixes</th>
            </tr>
          </thead>
          <tbody>
            {sla.categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-1 text-gray-600">
                  No issues in this period.
                </td>
              </tr>
            ) : (
              sla.categories.map((row) => <Row key={row.category} row={row} />)
            )}
          </tbody>
        </table>
      </div>
      {sla.openBreaches.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700">
            Open issues past their due date ({sla.openBreachCount})
            {sla.openBreachCount > sla.openBreaches.length && `, the ${sla.openBreaches.length} longest overdue`}
          </p>
          <ul className="text-xs text-gray-700 space-y-0.5">
            {sla.openBreaches.map((breach) => (
              <li key={`${breach.url}-${breach.kind}`}>
                <a href={breach.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  {breach.title}
                  <span className="sr-only">, opens in a new tab</span>
                </a>
                : {breach.kind === "response" ? "response" : "fix"} was due {breach.due.slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
        <li>
          Fixes are dated by the first stable release after the change that closed the issue ({sla.fixesByRelease}), or by
          closing the issue as completed when no closing change is known ({sla.fixesByClose}).
        </li>
        {sla.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        <li>The terms are proposals. The times give no stars and do not count towards the verdict.</li>
      </ul>
    </div>
  );
}
