import type { InformativeMetric } from "@/lib/types";

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center lg:min-h-0 text-cg-lightblue underline hover:text-cg-blue rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cg-blue";

interface MetricTableProps {
  caption: string;
  metrics: InformativeMetric[];
}

const TARGET_BADGE = {
  met: "border-green-300 text-green-800 bg-green-50",
  missed: "border-amber-300 text-amber-900 bg-amber-50",
  unknown: "border-gray-300 text-gray-700 bg-white",
};

function TargetCell({ metric }: { metric: InformativeMetric }) {
  if (!metric.target) return <span className="text-gray-500">none</span>;
  const { text, met } = metric.target;
  const [label, className] =
    met === true
      ? ["Meets target", TARGET_BADGE.met]
      : met === false
        ? ["Misses target", TARGET_BADGE.missed]
        : ["Not compared", TARGET_BADGE.unknown];
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="text-gray-700">{text}</span>
      <span className={`inline-flex font-semibold px-1.5 py-0.5 rounded-full border ${className}`}>{label}</span>
    </span>
  );
}

/**
 * Informative metrics with their value and explanation, without stars. A
 * metric with a KPI target shows whether it meets that target; the targets
 * are proposals and count in no rating.
 */
export default function MetricTable({ caption, metrics }: MetricTableProps) {
  const hasTargets = metrics.some((metric) => metric.target);
  return (
    <div className="relative overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="min-w-full text-xs text-left border border-gray-200">
        <caption className="text-left text-gray-600 pb-1">{caption}</caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="px-2 py-1">Metric</th>
            <th scope="col" className="px-2 py-1">Value</th>
            {hasTargets && (
              <th scope="col" className="px-2 py-1">
                Target (proposal)
              </th>
            )}
            <th scope="col" className="px-2 py-1">What it means</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.id} className="border-t border-gray-100 align-top">
              <th scope="row" className="min-w-[8rem] px-2 py-1 font-normal text-gray-800">
                <a href={metric.referenceUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  {metric.name}
                  <span className="sr-only">: definition, opens in a new tab</span>
                </a>
              </th>
              <td className="px-2 py-1 font-semibold text-gray-900 whitespace-nowrap">
                {metric.value ?? <span className="font-normal text-gray-600">not measured</span>}
              </td>
              {hasTargets && (
                <td className="px-2 py-1 whitespace-nowrap">
                  <TargetCell metric={metric} />
                </td>
              )}
              <td className="px-2 py-1 text-gray-700">{metric.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasTargets && (
        <p className="text-xs text-gray-600 pt-1">
          The targets are proposals until a governance decision sets them. Meeting or missing one gives no stars and does
          not count towards the verdict.
        </p>
      )}
    </div>
  );
}
