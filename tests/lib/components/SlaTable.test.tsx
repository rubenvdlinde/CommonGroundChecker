/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import SlaTable from "@/components/SlaTable";
import MetricTable from "@/components/MetricTable";
import type { SlaSummary } from "@/lib/types";

const sla: SlaSummary = {
  notMeasured: null,
  from: "2026-08-21",
  to: "2026-11-19",
  categories: [
    {
      category: "bug",
      label: "Other bug",
      respondDays: 5,
      fixDays: "next-release",
      count: 4,
      response: { measured: 3, median: 1.5, worst: 7, breaches: 1, waiting: 1 },
      fix: { measured: 2, median: 12, worst: 20, breaches: 0, waiting: 2 },
    },
    {
      category: "question",
      label: "Question",
      respondDays: 10,
      fixDays: null,
      count: 1,
      response: { measured: 1, median: 1, worst: 1, breaches: 0, waiting: 0 },
      fix: null,
    },
  ],
  openBreaches: [
    { title: "Login fails", url: "https://github.com/org/repo/issues/3", category: "bug", kind: "response", due: "2026-11-09T09:00:00.000Z" },
  ],
  openBreachCount: 1,
  fixesByRelease: 1,
  fixesByClose: 1,
  notes: ["No issue carries a blocking label (such as blocker or critical), so every bug counts as an other bug."],
};

describe("SlaTable", () => {
  afterEach(() => cleanup());

  it("shows per category the terms, counts, median and worst times and breaches", () => {
    render(<SlaTable sla={sla} />);

    const table = screen.getByRole("table", { name: /Issue response and fix times from 2026-08-21 to 2026-11-19/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("respond 5 days, fix next release");
    expect(rows[0].textContent).toContain("median 1.5 days, worst 7 days");
    expect(rows[0].textContent).toContain("1 still waiting");
    expect(rows[1].textContent).toContain("no fix term");
    expect(screen.getByText("Open issues past their due date (1)")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Login fails/ }).getAttribute("href")).toBe("https://github.com/org/repo/issues/3");
    expect(screen.getByText(/response was due 2026-11-09/)).toBeTruthy();
    expect(screen.getByText(/The terms are proposals/)).toBeTruthy();
    expect(screen.getByText(/every bug counts as an other bug/)).toBeTruthy();
  });

  it("says when only the longest overdue breaches are listed", () => {
    render(<SlaTable sla={{ ...sla, openBreachCount: 30 }} />);
    expect(screen.getByText("Open issues past their due date (30), the 1 longest overdue")).toBeTruthy();
  });

  it("says why nothing was measured", () => {
    render(<SlaTable sla={{ ...sla, notMeasured: "needs a GITHUB_TOKEN", categories: [] }} />);
    expect(screen.getByText("Issue response and fix times: not measured, needs a GITHUB_TOKEN.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("MetricTable with KPI targets", () => {
  afterEach(() => cleanup());

  const base = { referenceUrl: "https://chaoss.community/kb/metric-x/", explanation: "" };

  it("shows the target and whether it is met, as a proposal", () => {
    render(
      <MetricTable
        caption="Project health"
        metrics={[
          { ...base, id: "release-frequency", name: "Release Frequency", value: "6 in 12 months", target: { text: "at least 4 releases in 12 months", met: true } },
          { ...base, id: "contributor-absence-factor", name: "Contributor Absence Factor", value: "1", target: { text: "at least 2 people", met: false } },
          { ...base, id: "issue-response-time", name: "Issue Response Time", value: null, target: { text: "at most 120 hours", met: null } },
        ]}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Target (proposal)" })).toBeTruthy();
    expect(screen.getByText("Meets target")).toBeTruthy();
    expect(screen.getByText("Misses target")).toBeTruthy();
    expect(screen.getByText("Not compared")).toBeTruthy();
    expect(screen.getByText(/gives no stars and does not count towards the verdict/)).toBeTruthy();
  });

  it("has no target column without targets", () => {
    render(<MetricTable caption="Project health" metrics={[{ ...base, id: "x", name: "X", value: "1" }]} />);
    expect(screen.queryByRole("columnheader", { name: "Target (proposal)" })).toBeNull();
  });
});
