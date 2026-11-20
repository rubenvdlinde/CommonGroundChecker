import { USAGE_KIND_LABELS, describeUsageSource } from "@/lib/usage";
import type { UsageSource } from "@/lib/types";

const LINK_CLASS =
  "text-cg-lightblue underline hover:text-cg-blue rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cg-blue";

function SourceName({ source }: { source: UsageSource }) {
  const label = source.subject ? `${source.source}: ${source.subject}` : source.source;
  if (!source.url) return <>{label}</>;
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className={`${LINK_CLASS} break-all`}>
      {label}
    </a>
  );
}

/** One row per usage source with what it measured, when, and what the figures do not say. Never rated. */
export default function UsageTable({ caption, sources }: { caption: string; sources: UsageSource[] }) {
  return (
    <div className="relative overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="min-w-full text-xs text-left border border-gray-200">
        <caption className="text-left text-gray-600 pb-1">{caption}</caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="px-2 py-1">Source</th>
            <th scope="col" className="px-2 py-1">Kind</th>
            <th scope="col" className="px-2 py-1">Measured</th>
            <th scope="col" className="px-2 py-1">Date</th>
            <th scope="col" className="px-2 py-1">Caveat</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-t border-gray-100 align-top">
              <th scope="row" className="px-2 py-1 font-normal text-gray-800">
                <SourceName source={source} />
              </th>
              <td className="px-2 py-1 text-gray-800">{USAGE_KIND_LABELS[source.kind]}</td>
              <td className="px-2 py-1 text-gray-800">
                <span className={source.notMeasured ? "text-gray-600" : undefined}>{describeUsageSource(source)}</span>
                {source.names && source.names.length > 0 && (
                  <span className="block text-gray-700">{source.names.join(", ")}</span>
                )}
              </td>
              <td className="px-2 py-1 whitespace-nowrap text-gray-800">{source.measuredAt}</td>
              <td className="px-2 py-1 text-gray-700">{source.caveat}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
