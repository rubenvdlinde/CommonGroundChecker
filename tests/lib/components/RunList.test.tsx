/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import RunList from "@/components/RunList";

const runs = [
  { id: "new", checkedAt: "2026-11-11T15:39:33Z", version: "1.2.0", score: 82, rating: 3.4, passed: true, errors: 0, warnings: 2 },
  { id: "old", checkedAt: "2026-11-01T15:39:33Z", version: null, score: 45, rating: 1.8, passed: false, errors: 3, warnings: null },
];

const hrefFor = (id: string) => `/history/org/repo/${id}`;

describe("RunList", () => {
  afterEach(() => cleanup());

  it("lists every run with its date link, rating, result, errors, warnings and version, without the score", () => {
    render(<RunList runs={runs} selectedId="new" analysisHref={hrefFor} />);

    const table = screen.getByRole("table", { name: /All runs of this repository/ });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Run",
      "Rating",
      "Result",
      "Errors",
      "Warnings",
      "Version",
    ]);
    expect(table.textContent).not.toContain("/100");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);

    const newest = within(rows[0]);
    expect(newest.getByRole("link").getAttribute("href")).toBe("/history/org/repo/new");
    expect(newest.getByRole("img", { name: "Overall rating 3.4 of 5" })).toBeTruthy();
    expect(newest.getByText("Passes")).toBeTruthy();
    const counts = (row: HTMLElement) => within(row).getAllByRole("cell").slice(2, 4).map((cell) => cell.textContent);
    expect(counts(rows[0])).toEqual(["0", "2"]);
    expect(newest.getByText("1.2.0")).toBeTruthy();
    expect(newest.getByText("Latest")).toBeTruthy();

    const oldest = within(rows[1]);
    expect(oldest.getByRole("img", { name: "Overall rating 1.8 of 5" })).toBeTruthy();
    expect(oldest.getByText("Does not pass")).toBeTruthy();
    expect(counts(rows[1])).toEqual(["3", "–not stored"]);
    expect(oldest.getByText("unknown")).toBeTruthy();
    expect(oldest.queryByText("Latest")).toBeNull();
  });

  it("marks only the selected run as the current page", () => {
    render(<RunList runs={runs} selectedId="old" analysisHref={hrefFor} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, "page"]);
    expect(links[1].getAttribute("href")).toBe("/history/org/repo/old");
  });

  it("says so when no run is stored", () => {
    render(<RunList runs={[]} selectedId={null} analysisHref={hrefFor} />);

    expect(screen.getByText("No runs stored yet.")).toBeTruthy();
  });
});
