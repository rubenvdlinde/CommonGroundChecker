import { formatStars } from "@/lib/stars";
import { STAR_LEVELS, type MeasurementGroup, type MeasurementRow, type StarRating } from "@/lib/types";

interface MeasurementTableProps {
  caption: string;
  groups: MeasurementGroup[];
}

export function StarsText({ stars }: { stars: StarRating }) {
  return (
    <>
      <span aria-hidden="true" className="text-amber-700">
        {formatStars(stars)}
      </span>
      <span className="sr-only">
        {stars} {stars === 1 ? "star" : "stars"}
      </span>
    </>
  );
}

function EarnedCell({ row }: { row: MeasurementRow }) {
  if (row.stars !== null) return <StarsText stars={row.stars} />;
  return <span className="text-gray-600">{row.starsText ?? "not rated"}</span>;
}

/** Measured values against the thresholds of each star level, one row group per measured property. */
export default function MeasurementTable({ caption, groups }: MeasurementTableProps) {
  const columns = STAR_LEVELS.length + 3;

  return (
    <div className="relative overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="min-w-full text-xs text-left border border-gray-200">
        <caption className="text-left text-gray-600 pb-1">{caption}</caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="px-2 py-1">Measured</th>
            <th scope="col" className="px-2 py-1">Value</th>
            {STAR_LEVELS.map((level) => (
              <th key={level} scope="col" className="px-2 py-1 whitespace-nowrap">
                <StarsText stars={level} />
              </th>
            ))}
            <th scope="col" className="px-2 py-1">Earned</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.id}>
            <tr className="border-t border-gray-200 bg-gray-50">
              <th scope="rowgroup" colSpan={columns} className="px-2 py-1 font-semibold text-gray-800">
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-t border-gray-100">
                <th scope="row" className="px-2 py-1 font-normal text-gray-800">{row.label}</th>
                <td className="px-2 py-1 font-semibold text-gray-900">{row.value}</td>
                {STAR_LEVELS.map((level) => (
                  <td key={level} className="px-2 py-1 text-gray-700 whitespace-nowrap">
                    {row.thresholds[level] ?? <span className="text-gray-600">no level</span>}
                  </td>
                ))}
                <td className="px-2 py-1 whitespace-nowrap">
                  <EarnedCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
