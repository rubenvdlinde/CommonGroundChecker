/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import UsageHistoryChart, { axisMax, buildUsagePoints, CHART_HEIGHT } from "@/components/UsageHistoryChart";

const analyses = [
  { id: "c", checkedAt: "2026-11-19T10:00:00Z", declaredUserCount: 8, confirmedUserCount: 2 },
  { id: "a", checkedAt: "2026-11-01T10:00:00Z", declaredUserCount: 8, confirmedUserCount: 0 },
  { id: "old", checkedAt: "2026-10-01T10:00:00Z" },
  { id: "b", checkedAt: "2026-11-10T10:00:00Z", declaredUserCount: 8, confirmedUserCount: null },
];

describe("buildUsagePoints", () => {
  it("keeps analyses with both counts, oldest first", () => {
    expect(buildUsagePoints(analyses, 2).map((point) => point.id)).toEqual(["a", "c"]);
  });

  it("scales both counts to the same axis, zero at the bottom", () => {
    const [first, last] = buildUsagePoints(analyses, 2);
    expect(first.yConfirmed).toBeGreaterThan(last.yConfirmed);
    expect(first.yDeclared).toBe(last.yDeclared);
    expect(first.yConfirmed).toBe(CHART_HEIGHT - 28);
    expect(first.x).toBeLessThan(last.x);
  });
});

describe("axisMax", () => {
  it("reaches at least the minimum for Approved", () => {
    expect(axisMax([{ declared: 1, confirmed: 0 }], 2)).toBe(2);
    expect(axisMax([{ declared: 8, confirmed: 2 }], 2)).toBe(8);
    expect(axisMax([{ declared: 0, confirmed: 0 }], 0)).toBe(1);
  });
});

describe("UsageHistoryChart", () => {
  afterEach(() => cleanup());

  it("describes the latest counts and the proposed minimum", () => {
    render(<UsageHistoryChart analyses={analyses} minConfirmedUsers={2} />);

    expect(screen.getByText("Declared and confirmed users over time")).toBeTruthy();
    expect(screen.getByText(/Latest: 8 declared, 2 confirmed. Approved asks for 2 confirmed./)).toBeTruthy();
    expect(screen.getByText("proposed minimum 2")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("gives the counts as text when only one scan counted them", () => {
    render(<UsageHistoryChart analyses={[analyses[0]]} minConfirmedUsers={2} />);
    expect(screen.getByText(/One scan counted the users: 8 declared, 2 confirmed/)).toBeTruthy();
  });

  it("says when no scan counted the users", () => {
    render(<UsageHistoryChart analyses={[{ id: "x", checkedAt: "2026-11-01T10:00:00Z" }]} minConfirmedUsers={2} />);
    expect(screen.getByText("No scan has counted the users yet.")).toBeTruthy();
  });
});
