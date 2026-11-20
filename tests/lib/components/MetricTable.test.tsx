/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import MetricTable from "@/components/MetricTable";

const metrics = [
  {
    id: "contributor-absence-factor",
    name: "Contributor Absence Factor",
    referenceUrl: "https://chaoss.community/kb/metric-contributor-absence-factor/",
    value: "1",
    explanation: "The smallest number of contributors that make 50% of the commits.",
  },
];

describe("MetricTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("scrolls in a labelled, keyboard reachable region that clips its visually hidden text", () => {
    render(<MetricTable caption="What Project health is made of" metrics={metrics} />);

    const region = screen.getByRole("region", { name: "What Project health is made of" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("overflow-x-auto");
    // Positioned, so the sr-only link text is clipped by it rather than widening the page
    expect(region.className).toContain("relative");
    expect(within(region).getByRole("table", { name: "What Project health is made of" })).toBeTruthy();
  });

  it("gives the metric links a touch target of at least 44px below 1024px", () => {
    render(<MetricTable caption="What Project health is made of" metrics={metrics} />);

    const link = screen.getByRole("link", { name: /Contributor Absence Factor/ });
    expect(link.className).toContain("min-h-[44px]");
    expect(link.className).toContain("lg:min-h-0");
  });
});
