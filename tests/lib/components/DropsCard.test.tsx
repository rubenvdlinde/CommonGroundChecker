/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import DropsCard, { dropChange } from "@/components/DropsCard";
import type { MaintenanceDrop } from "@/generated/openapi-client";

function drop(overrides: Partial<MaintenanceDrop>): MaintenanceDrop {
  return {
    id: "d1",
    repoId: "repo-id",
    analysisId: "a2",
    previousAnalysisId: "a1",
    scannedRefKind: "release",
    kind: "criterion",
    subject: "license",
    label: "License",
    from: "pass",
    to: "fail",
    detectedAt: "2026-10-01T02:00:00.000Z",
    fixTermDays: 30,
    fixBy: "2026-10-31T02:00:00.000Z",
    resolvedAt: null,
    resolvedAnalysisId: null,
    overdue: false,
    ...overrides,
  };
}

describe("DropsCard", () => {
  afterEach(() => cleanup());

  it("lists the open drops, overdue first, with their fix-by date and fix term", () => {
    render(
      <DropsCard
        drops={[
          drop({ id: "rating", kind: "rating", subject: "Maintainability", label: "Maintainability rating", from: "4", to: "3", fixTermDays: 90, fixBy: "2027-01-01T02:00:00.000Z" }),
          drop({ id: "late", overdue: true }),
          drop({ id: "done", label: "Changelog", resolvedAt: "2026-10-10T02:00:00.000Z", resolvedAnalysisId: "a3" }),
        ]}
      />
    );

    const section = screen.getByRole("region", { name: "Drops to fix" });
    expect(within(section).getByText("2 open, 1 overdue")).toBeTruthy();
    const items = within(section).getAllByRole("listitem").slice(0, 2);
    expect(items[0].textContent).toContain("License");
    expect(items[0].textContent).toContain("Overdue");
    expect(items[0].textContent).toContain("Open drop, fix by 31-10-2026 (30 days)");
    expect(items[1].textContent).toContain("4 to 3 stars");
    expect(within(section).getByText(/fix terms are proposals/)).toBeTruthy();
    expect(within(section).getByText("Recently recovered (1)")).toBeTruthy();
  });

  it("says when no drop is open", () => {
    render(<DropsCard drops={[drop({ resolvedAt: "2026-10-10T02:00:00.000Z" })]} />);
    expect(screen.getByText("No open drops.")).toBeTruthy();
  });

  it("names the change of each kind of drop", () => {
    expect(dropChange({ kind: "criterion", from: "pass", to: "fail" })).toBe("pass to fail");
    expect(dropChange({ kind: "rating", from: "4", to: "3" })).toBe("4 to 3 stars");
    expect(dropChange({ kind: "verdict", from: "suitable", to: "not suitable" })).toBe("suitable to not suitable");
  });
});
