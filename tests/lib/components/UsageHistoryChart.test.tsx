/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import UsageHistoryChart, { axisMax, buildUsagePoints, CHART_HEIGHT } from "@/components/UsageHistoryChart";

const analyses = [
  { id: "c", checkedAt: "2026-11-19T10:00:00Z", declaredUserCount: 8 },
  { id: "a", checkedAt: "2026-11-01T10:00:00Z", declaredUserCount: 0 },
  { id: "old", checkedAt: "2026-10-01T10:00:00Z" },
  { id: "b", checkedAt: "2026-11-10T10:00:00Z", declaredUserCount: null },
];

describe("buildUsagePoints", () => {
  it("keeps analyses that counted the users, oldest first", () => {
    expect(buildUsagePoints(analyses, 2).map((point) => point.id)).toEqual(["a", "c"]);
  });

  it("puts zero at the bottom and the highest count at the top", () => {
    const [first, last] = buildUsagePoints(analyses, 2);
    expect(first.y).toBe(CHART_HEIGHT - 28);
    expect(last.y).toBe(12);
    expect(first.x).toBeLessThan(last.x);
  });
});

describe("axisMax", () => {
  it("reaches at least the minimum for Maintained", () => {
    expect(axisMax([1], 2)).toBe(2);
    expect(axisMax([8, 3], 2)).toBe(8);
    expect(axisMax([0], 0)).toBe(1);
  });
});

describe("UsageHistoryChart", () => {
  afterEach(() => cleanup());

  it("describes the latest count and the minimum", () => {
    render(<UsageHistoryChart analyses={analyses} minUsers={2} />);

    expect(screen.getByText("Users declared in publiccode.yml over time")).toBeTruthy();
    expect(screen.getByText(/Latest: 8. Maintained asks for 2./)).toBeTruthy();
    expect(screen.getByText("minimum 2")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("keeps the hidden table and its caption out of the layout", () => {
    render(<UsageHistoryChart analyses={analyses} minUsers={2} />);
    const table = screen.getByRole("table");
    expect(table.parentElement?.className).toContain("sr-only");
    expect(table.querySelector("caption")?.className).toContain("whitespace-normal");
  });

  it("gives the count as text when only one scan counted it", () => {
    render(<UsageHistoryChart analyses={[analyses[0]]} minUsers={2} />);
    expect(screen.getByText(/One scan counted 8 users declared in publiccode.yml/)).toBeTruthy();
  });

  it("says when no scan counted the users", () => {
    render(<UsageHistoryChart analyses={[{ id: "x", checkedAt: "2026-11-01T10:00:00Z" }]} minUsers={2} />);
    expect(screen.getByText("No scan has counted the users yet.")).toBeTruthy();
  });
});
