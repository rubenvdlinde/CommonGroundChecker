export interface UsageHistoryAnalysis {
  id: string;
  checkedAt: string;
  declaredUserCount?: number | null;
}

export interface UsagePoint {
  id: string;
  checkedAt: string;
  declared: number;
  x: number;
  y: number;
}

interface UsageHistoryChartProps {
  analyses: UsageHistoryAnalysis[];
  minUsers: number;
}

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 200;
const PADDING = { top: 12, right: 20, bottom: 28, left: 36 };
const PLOT_LEFT = PADDING.left;
const PLOT_RIGHT = CHART_WIDTH - PADDING.right;
const PLOT_TOP = PADDING.top;
const PLOT_BOTTOM = CHART_HEIGHT - PADDING.bottom;

/** The top of the count axis: the highest count or the minimum for Maintained, whichever is larger. */
export function axisMax(counts: number[], minUsers: number): number {
  return Math.max(minUsers, ...counts, 1);
}

function scaleY(value: number, max: number): number {
  return PLOT_BOTTOM - (value / max) * (PLOT_BOTTOM - PLOT_TOP);
}

/**
 * Orders analyses from oldest to newest and places the declared count in the
 * chart. Analyses that did not record users are left out.
 */
export function buildUsagePoints(analyses: UsageHistoryAnalysis[], minUsers: number): UsagePoint[] {
  const counted = analyses
    .map((analysis) => ({
      analysis,
      time: new Date(analysis.checkedAt).getTime(),
      declared: analysis.declaredUserCount,
    }))
    .filter(
      (entry): entry is typeof entry & { declared: number } =>
        Number.isFinite(entry.time) && typeof entry.declared === "number"
    )
    .sort((a, b) => a.time - b.time);
  if (counted.length === 0) return [];

  const max = axisMax(
    counted.map((entry) => entry.declared),
    minUsers
  );
  const minTime = counted[0].time;
  const maxTime = counted[counted.length - 1].time;
  const scaleX = (time: number) =>
    maxTime <= minTime ? (PLOT_LEFT + PLOT_RIGHT) / 2 : PLOT_LEFT + ((time - minTime) / (maxTime - minTime)) * (PLOT_RIGHT - PLOT_LEFT);

  return counted.map(({ analysis, time, declared }) => ({
    id: analysis.id,
    checkedAt: analysis.checkedAt,
    declared,
    x: scaleX(time),
    y: scaleY(declared, max),
  }));
}

function formatDay(checkedAt: string): string {
  return new Date(checkedAt).toLocaleDateString("nl-NL");
}

/** Users declared in publiccode.yml per analysis, in the style of the score graph. Informative: no stars. */
export default function UsageHistoryChart({ analyses, minUsers }: UsageHistoryChartProps) {
  const points = buildUsagePoints(analyses, minUsers);

  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        {points.length === 0
          ? "No scan has counted the users yet."
          : `One scan counted ${points[0].declared} users declared in publiccode.yml. The graph appears after the next scan.`}
      </p>
    );
  }

  const max = axisMax(
    points.map((point) => point.declared),
    minUsers
  );
  const first = points[0];
  const last = points[points.length - 1];
  const description = `Users declared in publiccode.yml in ${points.length} scans from ${formatDay(first.checkedAt)} to ${formatDay(
    last.checkedAt
  )}. Latest: ${last.declared}. Maintained asks for ${minUsers}.`;
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        aria-labelledby="usage-history-title usage-history-desc"
      >
        <title id="usage-history-title">Users declared in publiccode.yml over time</title>
        <desc id="usage-history-desc">{description}</desc>
        <g aria-hidden="true">
          {[0, max].map((value) => (
            <g key={value}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={scaleY(value, max)} y2={scaleY(value, max)} stroke="#e5e7eb" />
              <text
                x={PLOT_LEFT - 6}
                y={scaleY(value, max)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-500 text-[10px]"
              >
                {value}
              </text>
            </g>
          ))}
          <line
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={scaleY(minUsers, max)}
            y2={scaleY(minUsers, max)}
            stroke="#16a34a"
            strokeDasharray="4 4"
          />
          <text x={PLOT_RIGHT} y={scaleY(minUsers, max) - 4} textAnchor="end" className="fill-green-700 text-[10px]">
            minimum {minUsers}
          </text>
          <text x={PLOT_LEFT} y={CHART_HEIGHT - 8} className="fill-gray-500 text-[10px]">
            {formatDay(first.checkedAt)}
          </text>
          <text x={PLOT_RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" className="fill-gray-500 text-[10px]">
            {formatDay(last.checkedAt)}
          </text>
          <path d={linePath} fill="none" className="stroke-cg-blue" strokeWidth="2" strokeLinejoin="round" />
          {points.map((point) => (
            <circle key={point.id} cx={point.x} cy={point.y} r="4" className="fill-cg-blue" />
          ))}
        </g>
      </svg>
      {/* Tables do not clip their caption, so the wrapper keeps it out of the layout. */}
      <div className="sr-only">
        <table className="sr-only">
          <caption className="whitespace-normal">Users declared in publiccode.yml per scan, oldest first</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Declared users</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.id}>
                <td>{formatDay(point.checkedAt)}</td>
                <td>{point.declared}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
