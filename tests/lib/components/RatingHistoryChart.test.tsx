/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import RatingHistoryChart, {
  CHART_HEIGHT,
  CHART_PADDING,
  CHART_WIDTH,
  RATING_BANDS,
  buildChartPoints,
  scaleRating,
  scaleTime,
  tooltipPosition,
} from "@/components/RatingHistoryChart";

const plotTop = CHART_PADDING.top;
const plotBottom = CHART_HEIGHT - CHART_PADDING.bottom;
const plotLeft = CHART_PADDING.left;
const plotRight = CHART_WIDTH - CHART_PADDING.right;

const runs = [
  { id: "c", checkedAt: "2026-03-01T12:00:00Z", rating: 4.2, passed: true },
  { id: "a", checkedAt: "2026-01-01T12:00:00Z", rating: 1.9, passed: false },
  { id: "b", checkedAt: "2026-02-01T12:00:00Z", rating: 3, passed: true },
];

const hrefFor = (id: string) => `/history/owner/repo/${id}`;

describe("RatingHistoryChart scaling", () => {
  afterEach(() => cleanup());

  it("maps 0.5 to the bottom and 5.5 to the top of the plot", () => {
    expect(scaleRating(0.5)).toBe(plotBottom);
    expect(scaleRating(5.5)).toBe(plotTop);
    expect(scaleRating(3)).toBe((plotTop + plotBottom) / 2);
  });

  it("clamps ratings outside 0.5-5.5", () => {
    expect(scaleRating(0)).toBe(plotBottom);
    expect(scaleRating(7)).toBe(plotTop);
  });

  it("has one band per star between the star boundaries", () => {
    expect(RATING_BANDS.map((band) => [band.from, band.to])).toEqual([
      [0.5, 1.5],
      [1.5, 2.5],
      [2.5, 3.5],
      [3.5, 4.5],
      [4.5, 5.5],
    ]);
  });

  it("maps the time range onto the plot width, a single moment to the middle", () => {
    expect(scaleTime(10, 10, 20)).toBe(plotLeft);
    expect(scaleTime(20, 10, 20)).toBe(plotRight);
    expect(scaleTime(15, 10, 20)).toBe((plotLeft + plotRight) / 2);
    expect(scaleTime(10, 10, 10)).toBe((plotLeft + plotRight) / 2);
  });

  it("orders points oldest first and places them by date and rating", () => {
    const points = buildChartPoints(runs);

    expect(points.map((point) => point.id)).toEqual(["a", "b", "c"]);
    expect(points[0]).toMatchObject({ x: plotLeft, y: scaleRating(1.9), passed: false });
    expect(points[2]).toMatchObject({ x: plotRight, y: scaleRating(4.2), passed: true });
    const januaryToFebruary = 31 / (31 + 28);
    expect(points[1].x).toBeCloseTo(plotLeft + januaryToFebruary * (plotRight - plotLeft), 5);
    expect(points[1].y).toBe(scaleRating(3));
  });

  it("drops runs with an unparsable date or without a rating", () => {
    const points = buildChartPoints([
      ...runs,
      { id: "x", checkedAt: "not a date", rating: 2, passed: false },
      { id: "y", checkedAt: "2026-04-01T12:00:00Z", rating: null, passed: false },
    ]);
    expect(points.map((point) => point.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps tooltips inside the chart and below points near the top", () => {
    expect(tooltipPosition({ x: 0, y: 200 }).x).toBe(0);
    expect(tooltipPosition({ x: CHART_WIDTH, y: 200 }).x).toBeLessThan(CHART_WIDTH);
    const nearTop = tooltipPosition({ x: 300, y: plotTop });
    expect(nearTop.y).toBeGreaterThan(plotTop);
    const lower = tooltipPosition({ x: 300, y: 200 });
    expect(lower.y).toBeLessThan(200);
  });
});

describe("RatingHistoryChart rendering", () => {
  afterEach(() => cleanup());

  it("shows a short text instead of a graph without rated runs", () => {
    const { container } = render(
      <RatingHistoryChart
        runs={[{ id: "y", checkedAt: "2026-04-01T12:00:00Z", rating: null, passed: false }]}
        analysisHref={hrefFor}
      />
    );
    expect(screen.getByText(/No rated runs stored yet/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows a short text instead of a graph with one rated run", () => {
    const { container } = render(<RatingHistoryChart runs={[runs[0]]} analysisHref={hrefFor} />);
    expect(screen.getByText(/Only one rated run is stored/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a titled, described graph with star bands, a pass line and a link per run", () => {
    const { container } = render(<RatingHistoryChart runs={runs} analysisHref={hrefFor} />);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-labelledby")).toBe("rating-history-title rating-history-desc");
    expect(svg?.querySelector("title")?.textContent).toBe("Overall rating over time");
    const description = svg?.querySelector("desc")?.textContent;
    expect(description).toContain("Overall rating of 3 runs");
    expect(description).toContain("where 2.5 or more passes");
    expect(description).toContain("Lowest 1.9, highest 4.2, latest 4.2");

    const bandRects = Array.from(svg?.querySelectorAll("rect[class^='fill-'][class$='-50']") ?? []);
    expect(bandRects.map((rect) => Number(rect.getAttribute("y")))).toEqual(
      RATING_BANDS.map((band) => scaleRating(band.to))
    );
    const greenBand = svg?.querySelector("rect.fill-green-50");
    expect(Number(greenBand?.getAttribute("y"))).toBe(scaleRating(5.5));
    expect(Number(greenBand?.getAttribute("height"))).toBe(scaleRating(4.5) - scaleRating(5.5));

    const passLine = svg?.querySelector("line[data-pass-line]");
    expect(Number(passLine?.getAttribute("y1"))).toBe(scaleRating(2.5));
    expect(Number(passLine?.getAttribute("y2"))).toBe(scaleRating(2.5));

    const links = Array.from(svg?.querySelectorAll("a") ?? []);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/history/owner/repo/a",
      "/history/owner/repo/b",
      "/history/owner/repo/c",
    ]);
    expect(links[0].getAttribute("aria-label")).toContain("rating 1.9, does not pass");
    expect(links[2].getAttribute("aria-label")).toContain("rating 4.2, passes");
    expect(links.some((link) => link.hasAttribute("aria-current"))).toBe(false);
  });

  it("highlights the selected run's point", () => {
    const { container } = render(<RatingHistoryChart runs={runs} selectedId="b" analysisHref={hrefFor} />);

    const svg = container.querySelector("svg");
    const current = svg?.querySelectorAll("a[aria-current='page']");
    expect(current).toHaveLength(1);
    expect(current?.[0].getAttribute("href")).toBe("/history/owner/repo/b");
    const radii = Array.from(svg?.querySelectorAll("a") ?? []).map((link) =>
      link.querySelectorAll("circle")[2].getAttribute("r")
    );
    expect(radii).toEqual(["5", "7", "5"]);
    const points = buildChartPoints(runs);
    expect(Number(svg?.querySelector("line[data-selected-line]")?.getAttribute("x1"))).toBe(points[1].x);
    expect(svg?.querySelector("desc")?.textContent).toContain("rating 3.0.");
  });

  it("renders a visually hidden table with date, rating and result per run", () => {
    render(<RatingHistoryChart runs={runs} selectedId="c" analysisHref={hrefFor} />);

    const table = screen.getByRole("table", { name: /Overall rating per run/ });
    expect(table.className).toContain("sr-only");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Date", "Rating", "Result"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").slice(1).map((cell) => cell.textContent))).toEqual([
      ["1.9", "Does not pass"],
      ["3.0", "Passes"],
      ["4.2", "Passes"],
    ]);
    expect(within(rows[0]).getAllByRole("cell")[0].textContent).toBe(
      new Date("2026-01-01T12:00:00Z").toLocaleString("nl-NL")
    );
    expect(rows[2].getAttribute("aria-current")).toBe("true");
  });
});
