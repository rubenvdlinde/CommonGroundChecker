/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ResultCard from "@/components/ResultCard";
import ScanModeLine from "@/components/ScanModeLine";

const FROM = { analysisId: "a", checkedAt: "2026-11-12T02:00:00Z", commit: "abc1234def5678abc1234def5678abc1234def56" };

describe("ScanModeLine", () => {
  afterEach(() => cleanup());

  it("says the code checks were reused in a partial scan", () => {
    render(<ScanModeLine scanMode="partial" scanDurationSeconds={4.2} results={[{ reusedFrom: FROM }, {}]} />);

    expect(
      screen.getByText(
        "Code unchanged since 12 November 2026 (commit abc1234): code checks reused, outside-world checks run again. Scan took 4.2 s."
      )
    ).toBeTruthy();
  });

  it("says a full scan ran every check, and shows only the duration for an older analysis", () => {
    render(<ScanModeLine scanMode="full" scanDurationSeconds={182.4} results={[]} />);
    expect(screen.getByText("Full scan: every check ran. Scan took 3 min 2 s.")).toBeTruthy();
    cleanup();

    render(<ScanModeLine scanMode={null} scanDurationSeconds={12} results={[]} />);
    expect(screen.getByText("Scan took 12 s.")).toBeTruthy();
    cleanup();

    const { container } = render(<ScanModeLine results={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("ResultCard of a reused result", () => {
  afterEach(() => cleanup());

  it("marks the card reused and says which scan measured it", () => {
    render(
      <ResultCard id="complexity" title="Complexity" description="" status="pass" message="Fine" reusedFrom={FROM} />
    );

    expect(screen.getByText("reused")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByText("Reused from the scan of 12 November 2026 (commit abc1234). The code did not change since.")
    ).toBeTruthy();
  });

  it("has no reused note for a result measured in this scan", () => {
    render(<ResultCard id="usage" title="Usage" description="" status="info" message="Counted" />);

    expect(screen.queryByText("reused")).toBeNull();
  });
});
