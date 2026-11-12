/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import ScoreHistoryChart, {
  CHART_HEIGHT,
  CHART_PADDING,
  CHART_WIDTH,
  buildChartPoints,
  scaleScore,
  scaleTime,
  tooltipPosition,
} from "@/components/ScoreHistoryChart";

const plotTop = CHART_PADDING.top;
const plotBottom = CHART_HEIGHT - CHART_PADDING.bottom;
const plotLeft = CHART_PADDING.left;
const plotRight = CHART_WIDTH - CHART_PADDING.right;

const analyses = [
  { id: "c", checkedAt: "2026-03-01T12:00:00Z", score: 90 },
  { id: "a", checkedAt: "2026-01-01T12:00:00Z", score: 40 },
  { id: "b", checkedAt: "2026-02-01T12:00:00Z", score: 65 },
];

const hrefFor = (id: string) => `/history/owner/repo/${id}`;

describe("ScoreHistoryChart scaling", () => {
  afterEach(() => cleanup());

  it("maps 0 to the bottom and 100 to the top of the plot", () => {
    expect(scaleScore(0)).toBe(plotBottom);
    expect(scaleScore(100)).toBe(plotTop);
    expect(scaleScore(50)).toBe((plotTop + plotBottom) / 2);
  });

  it("clamps scores outside 0-100", () => {
    expect(scaleScore(-10)).toBe(plotBottom);
    expect(scaleScore(140)).toBe(plotTop);
  });

  it("maps the time range onto the plot width, a single moment to the middle", () => {
    expect(scaleTime(10, 10, 20)).toBe(plotLeft);
    expect(scaleTime(20, 10, 20)).toBe(plotRight);
    expect(scaleTime(15, 10, 20)).toBe((plotLeft + plotRight) / 2);
    expect(scaleTime(10, 10, 10)).toBe((plotLeft + plotRight) / 2);
  });

  it("orders points oldest first and places them by date and score", () => {
    const points = buildChartPoints(analyses);

    expect(points.map((point) => point.id)).toEqual(["a", "b", "c"]);
    expect(points[0]).toMatchObject({ x: plotLeft, y: scaleScore(40) });
    expect(points[2]).toMatchObject({ x: plotRight, y: scaleScore(90) });
    const januaryToFebruary = 31 / (31 + 28);
    expect(points[1].x).toBeCloseTo(plotLeft + januaryToFebruary * (plotRight - plotLeft), 5);
    expect(points[1].y).toBe(scaleScore(65));
  });

  it("drops analyses with an unparsable date", () => {
    const points = buildChartPoints([...analyses, { id: "x", checkedAt: "not a date", score: 10 }]);
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

describe("ScoreHistoryChart rendering", () => {
  afterEach(() => cleanup());

  it("shows a short text instead of a graph without analyses", () => {
    const { container } = render(<ScoreHistoryChart analyses={[]} analysisHref={hrefFor} />);
    expect(screen.getByText(/No analyses stored yet/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows a short text instead of a graph with one analysis", () => {
    const { container } = render(
      <ScoreHistoryChart analyses={[analyses[0]]} analysisHref={hrefFor} />
    );
    expect(screen.getByText(/Only one analysis is stored/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a titled, described graph with a focusable link per analysis", () => {
    const { container } = render(<ScoreHistoryChart analyses={analyses} analysisHref={hrefFor} />);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-labelledby")).toBe("score-history-title score-history-desc");
    expect(svg?.querySelector("title")?.textContent).toBe("Overall score over time");
    expect(svg?.querySelector("desc")?.textContent).toContain("Overall score of 3 analyses");
    expect(svg?.querySelector("desc")?.textContent).toContain("Lowest 40, highest 90, latest 90");

    const greenBand = svg?.querySelector("rect.fill-green-50");
    const yellowBand = svg?.querySelector("rect.fill-yellow-50");
    expect(Number(greenBand?.getAttribute("y"))).toBe(scaleScore(100));
    expect(Number(greenBand?.getAttribute("height"))).toBe(scaleScore(80) - scaleScore(100));
    expect(Number(yellowBand?.getAttribute("y"))).toBe(scaleScore(80));
    expect(Number(yellowBand?.getAttribute("height"))).toBe(scaleScore(50) - scaleScore(80));

    const links = Array.from(svg?.querySelectorAll("a") ?? []);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/history/owner/repo/a",
      "/history/owner/repo/b",
      "/history/owner/repo/c",
    ]);
    expect(links[0].getAttribute("aria-label")).toContain("score 40");
    expect(links[0].textContent).toContain("score 40");
  });

  it("renders a visually hidden table with date and score per analysis", () => {
    render(<ScoreHistoryChart analyses={analyses} analysisHref={hrefFor} />);

    const table = screen.getByRole("table", { name: /Overall score per analysis/ });
    expect(table.className).toContain("sr-only");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Date", "Score"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual([
      "40",
      "65",
      "90",
    ]);
    expect(within(rows[0]).getAllByRole("cell")[0].textContent).toBe(
      new Date("2026-01-01T12:00:00Z").toLocaleString("nl-NL")
    );
  });
});
