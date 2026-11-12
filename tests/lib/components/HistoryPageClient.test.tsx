/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import HistoryPageClient from "@/components/HistoryPageClient";
import type { RepoSummary } from "@/generated/openapi-client";

function repository(name: string, latestAnalysis: RepoSummary["latestAnalysis"]): RepoSummary {
  return {
    id: name,
    owner: "org",
    name,
    repoUrl: `https://github.com/org/${name}`,
    helmChartLocations: [],
    dockerLocations: [],
    apiSpecificationLocations: [],
    documentationLocations: [],
    displayName: null,
    shortDescription: null,
    logoUrl: null,
    developmentStatus: null,
    maintenanceType: null,
    maintainers: [],
    updatedAt: "2026-11-11T15:39:33Z",
    analysisCount: 1,
    latestAnalysis,
  };
}

describe("HistoryPageClient", () => {
  afterEach(() => cleanup());

  it("shows the latest overall rating next to the score", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        repositories={[
          repository("rated", { checkedAt: "2026-11-11T15:39:33Z", score: 71, rating: 3.4 }),
          repository("older", { checkedAt: "2026-11-10T15:39:33Z", score: 50 }),
        ]}
      />
    );

    expect(screen.getAllByRole("img", { name: /^Overall rating/ })).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Overall rating 3.4 of 5" })).toBeTruthy();
    expect(screen.getByText("Latest score: 71")).toBeTruthy();
  });
});
