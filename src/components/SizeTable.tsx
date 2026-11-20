import {
  QSM_LINES_PER_FUNCTION_POINT,
  SIG_V17_LINES_PER_PERSON_YEAR,
  formatCount,
  formatPersonYears,
  proxyNote,
  sizeEstimates,
} from "@/lib/size";
import type { SizeMeasurement } from "@/lib/types";

/** Lines of code per language, with the rebuild effort and the SIG-style volume below it. */
export default function SizeTable({ caption, size }: { caption: string; size: SizeMeasurement }) {
  const estimates = sizeEstimates(size);
  const backfiringNote = proxyNote(estimates.backfiringProxies, QSM_LINES_PER_FUNCTION_POINT);
  const sigNote = proxyNote(estimates.sigStyleProxies, SIG_V17_LINES_PER_PERSON_YEAR);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-left border border-gray-200">
          <caption className="text-left text-gray-600 pb-1">
            {caption}: production code, counted with {size.tool}
          </caption>
          <thead className="bg-cg-gray">
            <tr>
              <th scope="col" className="px-2 py-1">Language</th>
              <th scope="col" className="px-2 py-1 text-right">Files</th>
              <th scope="col" className="px-2 py-1 text-right">Lines of code</th>
            </tr>
          </thead>
          <tbody>
            {size.languages.map((language) => (
              <tr key={language.language} className="border-t border-gray-100">
                <th scope="row" className="px-2 py-1 font-normal text-gray-800">{language.language}</th>
                <td className="px-2 py-1 text-right text-gray-800">{formatCount(language.files)}</td>
                <td className="px-2 py-1 text-right text-gray-800">{formatCount(language.loc)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <th scope="row" className="px-2 py-1 font-semibold text-gray-800">Total</th>
              <td className="px-2 py-1 text-right font-semibold text-gray-900">{formatCount(size.files)}</td>
              <td className="px-2 py-1 text-right font-semibold text-gray-900">{formatCount(size.loc)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <dl className="text-xs text-gray-800 space-y-1">
        <div>
          <dt className="inline font-semibold">Rebuild effort, open estimate: </dt>
          <dd className="inline">
            {formatPersonYears(estimates.rebuildPersonYears)} ({formatCount(estimates.functionPoints)} function points,
            backfired with QSM v5.0 lines per function point and ISBSG hours per function point
            {backfiringNote ? `; ${backfiringNote}` : ""}).
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">SIG-style volume: </dt>
          <dd className="inline">
            {formatPersonYears(estimates.sigStylePersonYears)}, from the SIG v17.0 lines per person-year
            {sigNote ? ` (${sigNote}, a proxy because SIG published no factor)` : ""}. Context, not part of the 2026
            rating.
          </dd>
        </div>
      </dl>
      {estimates.unmodelledLoc > 0 && (
        <p className="text-xs text-gray-600">
          {formatCount(estimates.unmodelledLoc)} lines are in a language without an effort factor and are left out of
          both estimates.
        </p>
      )}
    </div>
  );
}
