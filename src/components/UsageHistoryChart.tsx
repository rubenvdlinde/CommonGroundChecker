export interface UsageHistoryAnalysis {
  id: string;
  checkedAt: string;
  declaredUserCount?: number | null;
  confirmedUserCount?: number | null;
}

export interface UsagePoint {
  id: string;
  checkedAt: string;
  declared: number;
  confirmed: number;
  x: number;
  yDeclared: number;
  yConfirmed: number;
}

interface UsageHistoryChartProps {
  analyses: UsageHistoryAnalysis[];
  minConfirmedUsers: number;
}

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 200;
const PADDING = { top: 12, right: 20, bottom: 28, left: 36 };
const PLOT_LEFT = PADDING.left;
const PLOT_RIGHT = CHART_WIDTH - PADDING.right;
const PLOT_TOP = PADDING.top;
const PLOT_BOTTOM = CHART_HEIGHT - PADDING.bottom;

/** The top of the count axis: the highest count or the minimum for Approved, whichever is larger. */
export function axisMax(analyses: Array<{ declared: number; confirmed: number }>, minConfirmedUsers: number): number {
  return Math.max(minConfirmedUsers, ...analyses.map((analysis) => Math.max(analysis.declared, analysis.confirmed)), 1);
}

/**
 * Orders analyses from oldest to newest and places both counts in the chart.
 * Analyses that did not record users are left out.
 */
export function buildUsagePoints(analyses: UsageHistoryAnalysis[], minConfirmedUsers: number): UsagePoint[] {
  const counted = analyses
    .map((analysis) => ({
      analysis,
      time: new Date(analysis.checkedAt).getTime(),
      declared: analysis.declaredUserCount,
      confirmed: analysis.confirmedUserCount,
    }))
    .filter(
      (entry): entry is typeof entry & { declared: number; confirmed: number } =>
        Number.isFinite(entry.time) &&
        typeof entry.declared === "number" &&
        typeof entry.confirmed === "number"
    )
    .sort((a, b) => a.time - b.time);
  if (counted.length === 0) return [];

  const max = axisMax(counted, minConfirmedUsers);
  const minTime = counted[0].time;
  const maxTime = counted[counted.length - 1].time;
  const scaleY = (value: number) => PLOT_BOTTOM - (value / max) * (PLOT_BOTTOM - PLOT_TOP);
  const scaleX = (time: number) =>
    maxTime <= minTime ? (PLOT_LEFT + PLOT_RIGHT) / 2 : PLOT_LEFT + ((time - minTime) / (maxTime - minTime)) * (PLOT_RIGHT - PLOT_LEFT);

  return counted.map(({ analysis, time, declared, confirmed }) => ({
    id: analysis.id,
    checkedAt: analysis.checkedAt,
    declared,
    confirmed,
    x: scaleX(time),
    yDeclared: scaleY(declared),
    yConfirmed: scaleY(confirmed),
  }));
}

function path(points: UsagePoint[], key: "yDeclared" | "yConfirmed"): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point[key].toFixed(1)}`).join(" ");
}

function formatDay(checkedAt: string): string {
  return new Date(checkedAt).toLocaleDateString("nl-NL");
}

/** Declared and confirmed users per analysis, in the style of the score graph. Informative: no stars. */
export default function UsageHistoryChart({ analyses, minConfirmedUsers }: UsageHistoryChartProps) {
  const points = buildUsagePoints(analyses, minConfirmedUsers);

  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        {points.length === 0
          ? "No scan has counted the users yet."
          : `One scan counted the users: ${points[0].declared} declared, ${points[0].confirmed} confirmed. The graph appears after the next scan.`}
      </p>
    );
  }

  const max = axisMax(points, minConfirmedUsers);
  const scaleY = (value: number) => PLOT_BOTTOM - (value / max) * (PLOT_BOTTOM - PLOT_TOP);
  const first = points[0];
  const last = points[points.length - 1];
  const description = `Declared and confirmed users of ${points.length} scans from ${formatDay(first.checkedAt)} to ${formatDay(
    last.checkedAt
  )}. Latest: ${last.declared} declared, ${last.confirmed} confirmed. Approved asks for ${minConfirmedUsers} confirmed.`;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        aria-labelledby="usage-history-title usage-history-desc"
      >
        <title id="usage-history-title">Declared and confirmed users over time</title>
        <desc id="usage-history-desc">{description}</desc>
        <g aria-hidden="true">
          {[0, max].map((value) => (
            <g key={value}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={scaleY(value)} y2={scaleY(value)} stroke="#e5e7eb" />
              <text
                x={PLOT_LEFT - 6}
                y={scaleY(value)}
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
            y1={scaleY(minConfirmedUsers)}
            y2={scaleY(minConfirmedUsers)}
            stroke="#16a34a"
            strokeDasharray="4 4"
          />
          <text x={PLOT_RIGHT} y={scaleY(minConfirmedUsers) - 4} textAnchor="end" className="fill-green-700 text-[10px]">
            proposed minimum {minConfirmedUsers}
          </text>
          <text x={PLOT_LEFT} y={CHART_HEIGHT - 8} className="fill-gray-500 text-[10px]">
            {formatDay(first.checkedAt)}
          </text>
          <text x={PLOT_RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" className="fill-gray-500 text-[10px]">
            {formatDay(last.checkedAt)}
          </text>
          <path d={path(points, "yDeclared")} fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinejoin="round" />
          <path d={path(points, "yConfirmed")} fill="none" className="stroke-cg-blue" strokeWidth="2" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.id}>
              <circle cx={point.x} cy={point.yDeclared} r="4" fill="#9ca3af" />
              <circle cx={point.x} cy={point.yConfirmed} r="4" className="fill-cg-blue" />
            </g>
          ))}
        </g>
      </svg>
      <p className="flex gap-4 text-xs text-gray-600" aria-hidden="true">
        <span>
          <span className="inline-block w-3 h-0.5 align-middle bg-gray-400 mr-1" />
          Declared under usedBy
        </span>
        <span>
          <span className="inline-block w-3 h-0.5 align-middle bg-cg-blue mr-1" />
          Confirmed
        </span>
      </p>
      <table className="sr-only">
        <caption>Declared and confirmed users per scan, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Declared</th>
            <th scope="col">Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{formatDay(point.checkedAt)}</td>
              <td>{point.declared}</td>
              <td>{point.confirmed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
