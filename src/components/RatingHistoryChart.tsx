import { STAR_BOUNDARIES } from "@/lib/componentRating";
import { MAX_RATING, MIN_RATING, PASSING_RATING } from "@/lib/ratings";

export interface RatingHistoryRun {
  id: string;
  checkedAt: string;
  /** Overall rating from 0.5 to 5.5, or null when the run is not rated */
  rating: number | null;
  passed: boolean;
}

export interface ChartPoint {
  id: string;
  checkedAt: string;
  rating: number;
  passed: boolean;
  x: number;
  y: number;
}

interface RatingHistoryChartProps {
  runs: RatingHistoryRun[];
  /** The run the page shows; its point is highlighted */
  selectedId?: string | null;
  analysisHref: (analysisId: string) => string;
}

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 240;
export const CHART_PADDING = { top: 12, right: 20, bottom: 28, left: 36 };

const PLOT_LEFT = CHART_PADDING.left;
const PLOT_RIGHT = CHART_WIDTH - CHART_PADDING.right;
const PLOT_TOP = CHART_PADDING.top;
const PLOT_BOTTOM = CHART_HEIGHT - CHART_PADDING.bottom;

const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 24;

/** One band per number of stars, between the star boundaries. */
export const RATING_BANDS = [
  { from: MIN_RATING, to: STAR_BOUNDARIES[0], className: "fill-red-50" },
  { from: STAR_BOUNDARIES[0], to: STAR_BOUNDARIES[1], className: "fill-orange-50" },
  { from: STAR_BOUNDARIES[1], to: STAR_BOUNDARIES[2], className: "fill-yellow-50" },
  { from: STAR_BOUNDARIES[2], to: STAR_BOUNDARIES[3], className: "fill-lime-50" },
  { from: STAR_BOUNDARIES[3], to: MAX_RATING, className: "fill-green-50" },
];

const AXIS_VALUES = [MIN_RATING, ...STAR_BOUNDARIES, MAX_RATING];

/** Maps a rating (0.5-5.5, clamped) to a y coordinate; 5.5 is at the top. */
export function scaleRating(rating: number): number {
  const clamped = Math.max(MIN_RATING, Math.min(MAX_RATING, rating));
  return PLOT_BOTTOM - ((clamped - MIN_RATING) / (MAX_RATING - MIN_RATING)) * (PLOT_BOTTOM - PLOT_TOP);
}

/** Maps a timestamp to an x coordinate; a single moment sits in the middle. */
export function scaleTime(time: number, minTime: number, maxTime: number): number {
  if (maxTime <= minTime) return (PLOT_LEFT + PLOT_RIGHT) / 2;
  return PLOT_LEFT + ((time - minTime) / (maxTime - minTime)) * (PLOT_RIGHT - PLOT_LEFT);
}

/** Orders rated runs from oldest to newest and places each one in the chart; unrated and undated runs are dropped. */
export function buildChartPoints(runs: RatingHistoryRun[]): ChartPoint[] {
  const dated = runs
    .map((run) => ({ run, time: new Date(run.checkedAt).getTime() }))
    .filter(
      (entry): entry is { run: RatingHistoryRun & { rating: number }; time: number } =>
        Number.isFinite(entry.time) && entry.run.rating !== null && Number.isFinite(entry.run.rating)
    )
    .sort((a, b) => a.time - b.time);

  if (dated.length === 0) return [];
  const minTime = dated[0].time;
  const maxTime = dated[dated.length - 1].time;

  return dated.map(({ run, time }) => ({
    id: run.id,
    checkedAt: run.checkedAt,
    rating: run.rating,
    passed: run.passed,
    x: scaleTime(time, minTime, maxTime),
    y: scaleRating(run.rating),
  }));
}

/** Places a point's tooltip above it, or below it near the top, and keeps it inside the chart. */
export function tooltipPosition(point: Pick<ChartPoint, "x" | "y">): { x: number; y: number } {
  const x = Math.max(0, Math.min(CHART_WIDTH - TOOLTIP_WIDTH, point.x - TOOLTIP_WIDTH / 2));
  const above = point.y - TOOLTIP_HEIGHT - 10;
  const y = above >= 0 ? above : point.y + 10;
  return { x, y };
}

function passText(passed: boolean): string {
  return passed ? "Passes" : "Does not pass";
}

function formatDate(checkedAt: string): string {
  return new Date(checkedAt).toLocaleString("nl-NL");
}

function formatDay(checkedAt: string): string {
  return new Date(checkedAt).toLocaleDateString("nl-NL");
}

export default function RatingHistoryChart({ runs, selectedId = null, analysisHref }: RatingHistoryChartProps) {
  const points = buildChartPoints(runs);

  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        {points.length === 0
          ? "No rated runs stored yet, so there is no rating history to show."
          : "Only one rated run is stored. The rating graph appears after the next run."}
      </p>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const ratings = points.map((point) => point.rating);
  const selected = points.find((point) => point.id === selectedId);
  const description =
    `Overall rating of ${points.length} runs from ${formatDay(first.checkedAt)} to ${formatDay(last.checkedAt)}, ` +
    `on a scale from ${MIN_RATING} to ${MAX_RATING} where ${PASSING_RATING} or more passes. ` +
    `Lowest ${Math.min(...ratings).toFixed(1)}, highest ${Math.max(...ratings).toFixed(1)}, latest ${last.rating.toFixed(1)}.` +
    (selected ? ` Shown run: ${formatDate(selected.checkedAt)}, rating ${selected.rating.toFixed(1)}.` : "");
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        aria-labelledby="rating-history-title rating-history-desc"
      >
        <title id="rating-history-title">Overall rating over time</title>
        <desc id="rating-history-desc">{description}</desc>

        <g aria-hidden="true">
          {RATING_BANDS.map((band) => (
            <rect
              key={band.from}
              x={PLOT_LEFT}
              y={scaleRating(band.to)}
              width={PLOT_RIGHT - PLOT_LEFT}
              height={scaleRating(band.from) - scaleRating(band.to)}
              className={band.className}
            />
          ))}
          {AXIS_VALUES.map((value) => (
            <g key={value}>
              {value !== PASSING_RATING && (
                <line
                  x1={PLOT_LEFT}
                  x2={PLOT_RIGHT}
                  y1={scaleRating(value)}
                  y2={scaleRating(value)}
                  stroke="#e5e7eb"
                  strokeDasharray={value === MIN_RATING || value === MAX_RATING ? undefined : "4 4"}
                />
              )}
              <text
                x={PLOT_LEFT - 6}
                y={scaleRating(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-500 text-[10px]"
              >
                {value.toFixed(1)}
              </text>
            </g>
          ))}
          <line
            data-pass-line=""
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={scaleRating(PASSING_RATING)}
            y2={scaleRating(PASSING_RATING)}
            className="stroke-red-600"
            strokeWidth="1.5"
          />
          <text
            x={PLOT_RIGHT - 4}
            y={scaleRating(PASSING_RATING) - 4}
            textAnchor="end"
            className="fill-red-700 text-[10px] font-semibold"
          >
            Pass {PASSING_RATING.toFixed(1)}
          </text>
          <text x={PLOT_LEFT} y={CHART_HEIGHT - 8} className="fill-gray-500 text-[10px]">
            {formatDay(first.checkedAt)}
          </text>
          <text x={PLOT_RIGHT} y={CHART_HEIGHT - 8} textAnchor="end" className="fill-gray-500 text-[10px]">
            {formatDay(last.checkedAt)}
          </text>
          {selected && (
            <line
              data-selected-line=""
              x1={selected.x}
              x2={selected.x}
              y1={PLOT_TOP}
              y2={PLOT_BOTTOM}
              className="stroke-cg-blue"
              strokeDasharray="2 3"
            />
          )}
          <path d={linePath} fill="none" className="stroke-cg-blue" strokeWidth="2" strokeLinejoin="round" />
        </g>

        {points.map((point) => {
          const tooltip = tooltipPosition(point);
          const isSelected = point.id === selected?.id;
          const label = `${formatDate(point.checkedAt)}, rating ${point.rating.toFixed(1)}, ${passText(
            point.passed
          ).toLowerCase()}`;
          return (
            <a
              key={point.id}
              href={analysisHref(point.id)}
              aria-label={`Open the run of ${label}`}
              aria-current={isSelected ? "page" : undefined}
              className="group focus:outline-none"
            >
              <circle cx={point.x} cy={point.y} r="12" fill="transparent" />
              <circle
                cx={point.x}
                cy={point.y}
                r="11"
                fill="none"
                strokeWidth="2"
                className="stroke-cg-lightblue opacity-0 group-focus-visible:opacity-100"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={isSelected ? 7 : 5}
                className={`${point.passed ? "fill-green-600" : "fill-red-500"} ${
                  isSelected ? "stroke-cg-blue" : "stroke-white group-hover:stroke-cg-blue"
                }`}
                strokeWidth={isSelected ? 3 : 2}
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

      <p className="flex flex-wrap gap-4 text-xs text-gray-600" aria-hidden="true">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" /> Passes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Does not pass
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-red-600" /> Pass line at {PASSING_RATING.toFixed(1)}
        </span>
        {selected && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border-[3px] border-cg-blue" /> Shown run
          </span>
        )}
      </p>

      <table className="sr-only">
        <caption>Overall rating per run, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Rating</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id} aria-current={point.id === selected?.id ? "true" : undefined}>
              <td>{formatDate(point.checkedAt)}</td>
              <td>{point.rating.toFixed(1)}</td>
              <td>{passText(point.passed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
