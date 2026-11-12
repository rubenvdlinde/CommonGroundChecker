export interface ScoreHistoryAnalysis {
  id: string;
  checkedAt: string;
  score: number;
}

export interface ChartPoint {
  id: string;
  checkedAt: string;
  score: number;
  x: number;
  y: number;
}

interface ScoreHistoryChartProps {
  analyses: ScoreHistoryAnalysis[];
  analysisHref: (analysisId: string) => string;
}

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 240;
export const CHART_PADDING = { top: 12, right: 20, bottom: 28, left: 36 };

const PLOT_LEFT = CHART_PADDING.left;
const PLOT_RIGHT = CHART_WIDTH - CHART_PADDING.right;
const PLOT_TOP = CHART_PADDING.top;
const PLOT_BOTTOM = CHART_HEIGHT - CHART_PADDING.bottom;

const TOOLTIP_WIDTH = 168;
const TOOLTIP_HEIGHT = 24;

/** Thresholds shared with ScoreBadge. */
const THRESHOLDS = [80, 50];

const bands = [
  { from: 80, to: 100, className: "fill-green-50" },
  { from: 50, to: 80, className: "fill-yellow-50" },
  { from: 0, to: 50, className: "fill-red-50" },
];

/** Maps a score (0-100, clamped) to a y coordinate; 100 is at the top. */
export function scaleScore(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return PLOT_BOTTOM - (clamped / 100) * (PLOT_BOTTOM - PLOT_TOP);
}

/** Maps a timestamp to an x coordinate; a single moment sits in the middle. */
export function scaleTime(time: number, minTime: number, maxTime: number): number {
  if (maxTime <= minTime) return (PLOT_LEFT + PLOT_RIGHT) / 2;
  return PLOT_LEFT + ((time - minTime) / (maxTime - minTime)) * (PLOT_RIGHT - PLOT_LEFT);
}

/** Orders analyses from oldest to newest and places each one in the chart; unparsable entries are dropped. */
export function buildChartPoints(analyses: ScoreHistoryAnalysis[]): ChartPoint[] {
  const dated = analyses
    .map((analysis) => ({ analysis, time: new Date(analysis.checkedAt).getTime() }))
    .filter(({ analysis, time }) => Number.isFinite(time) && Number.isFinite(analysis.score))
    .sort((a, b) => a.time - b.time);

  if (dated.length === 0) return [];
  const minTime = dated[0].time;
  const maxTime = dated[dated.length - 1].time;

  return dated.map(({ analysis, time }) => ({
    id: analysis.id,
    checkedAt: analysis.checkedAt,
    score: analysis.score,
    x: scaleTime(time, minTime, maxTime),
    y: scaleScore(analysis.score),
  }));
}

/** Places a point's tooltip above it, or below it near the top, and keeps it inside the chart. */
export function tooltipPosition(point: Pick<ChartPoint, "x" | "y">): { x: number; y: number } {
  const x = Math.max(0, Math.min(CHART_WIDTH - TOOLTIP_WIDTH, point.x - TOOLTIP_WIDTH / 2));
  const above = point.y - TOOLTIP_HEIGHT - 10;
  const y = above >= 0 ? above : point.y + 10;
  return { x, y };
}

function pointClass(score: number): string {
  if (score >= 80) return "fill-green-500";
  if (score >= 50) return "fill-yellow-400";
  return "fill-red-400";
}

function formatDate(checkedAt: string): string {
  return new Date(checkedAt).toLocaleString("nl-NL");
}

function formatDay(checkedAt: string): string {
  return new Date(checkedAt).toLocaleDateString("nl-NL");
}

export default function ScoreHistoryChart({ analyses, analysisHref }: ScoreHistoryChartProps) {
  const points = buildChartPoints(analyses);

  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        {points.length === 0
          ? "No analyses stored yet, so there is no score history to show."
          : "Only one analysis is stored. The score graph appears after the next analysis."}
      </p>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const scores = points.map((point) => point.score);
  const description = `Overall score of ${points.length} analyses from ${formatDay(first.checkedAt)} to ${formatDay(
    last.checkedAt
  )}. Lowest ${Math.min(...scores)}, highest ${Math.max(...scores)}, latest ${last.score}.`;
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        aria-labelledby="score-history-title score-history-desc"
      >
        <title id="score-history-title">Overall score over time</title>
        <desc id="score-history-desc">{description}</desc>

        <g aria-hidden="true">
          {bands.map((band) => (
            <rect
              key={band.from}
              x={PLOT_LEFT}
              y={scaleScore(band.to)}
              width={PLOT_RIGHT - PLOT_LEFT}
              height={scaleScore(band.from) - scaleScore(band.to)}
              className={band.className}
            />
          ))}
          {[0, ...THRESHOLDS, 100].map((value) => (
            <g key={value}>
              <line
                x1={PLOT_LEFT}
                x2={PLOT_RIGHT}
                y1={scaleScore(value)}
                y2={scaleScore(value)}
                stroke="#e5e7eb"
                strokeDasharray={THRESHOLDS.includes(value) ? "4 4" : undefined}
              />
              <text
                x={PLOT_LEFT - 6}
                y={scaleScore(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-500 text-[10px]"
              >
                {value}
              </text>
            </g>
          ))}
          <text x={PLOT_LEFT} y={CHART_HEIGHT - 8} className="fill-gray-500 text-[10px]">
            {formatDay(first.checkedAt)}
          </text>
          <text x={PLOT_RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" className="fill-gray-500 text-[10px]">
            {formatDay(last.checkedAt)}
          </text>
          <path d={linePath} fill="none" className="stroke-cg-blue" strokeWidth="2" strokeLinejoin="round" />
        </g>

        {points.map((point) => {
          const tooltip = tooltipPosition(point);
          const label = `${formatDate(point.checkedAt)}, score ${point.score}`;
          return (
            <a
              key={point.id}
              href={analysisHref(point.id)}
              aria-label={`Open analysis of ${label}`}
              className="group focus:outline-none"
            >
              <circle cx={point.x} cy={point.y} r="12" fill="transparent" />
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                className={`${pointClass(point.score)} stroke-white group-hover:stroke-cg-blue group-focus:stroke-cg-blue`}
                strokeWidth="2"
              />
              <g
                aria-hidden="true"
                className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 pointer-events-none"
              >
                <rect
                  x={tooltip.x}
                  y={tooltip.y}
                  width={TOOLTIP_WIDTH}
                  height={TOOLTIP_HEIGHT}
                  rx="6"
                  className="fill-white stroke-gray-300"
                />
                <text
                  x={tooltip.x + TOOLTIP_WIDTH / 2}
                  y={tooltip.y + TOOLTIP_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-800 text-[11px] font-semibold"
                >
                  {label}
                </text>
              </g>
            </a>
          );
        })}
      </svg>

      <table className="sr-only">
        <caption>Overall score per analysis, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{formatDate(point.checkedAt)}</td>
              <td>{point.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
