/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import RepoMeta from "@/components/RepoMeta";
import HistoryPageClient from "@/components/HistoryPageClient";
import type { CheckReport } from "@/lib/types";
import type { RepoSummary } from "@/generated/openapi-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const baseMeta: CheckReport["repoMeta"] = {
  description: "GitHub description",
  language: "Python",
  stars: 1,
  forks: 2,
  defaultBranch: "main",
  topics: [],
  license: "EUPL-1.2",
  version: "v1.31.0",
  versionEvidence: { source: "release", detail: "latest release" },
  displayName: null,
  shortDescription: null,
  logoUrl: null,
  developmentStatus: null,
  maintenanceType: null,
  maintainers: [],
};

const baseSummary: RepoSummary = {
  id: "repo-id",
  owner: "open-zaak",
  name: "open-zaak",
  repoUrl: "https://github.com/open-zaak/open-zaak",
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
  updatedAt: "2026-11-11T00:00:00Z",
  followed: false,
  checkIntervalHours: 168,
  lastCheckedAt: "2026-11-11T00:00:00Z",
  nextCheckAt: "2026-11-18T00:00:00Z",
  analysisCount: 1,
  latestAnalysis: null,
};

afterEach(() => {
  cleanup();
});

describe("RepoMeta", () => {
  it("shows the publiccode.yml logo, name, short description and status", () => {
    render(
      <RepoMeta
        owner="open-zaak"
        repo="open-zaak"
        repoMeta={{
          ...baseMeta,
          displayName: "Open Zaak",
          shortDescription: "API's voor Zaakgericht werken",
          logoUrl: "https://raw.githubusercontent.com/open-zaak/open-zaak/main/docs/logo.svg",
          developmentStatus: "stable",
          maintenanceType: "contract",
          maintainers: ["Maykin Media"],
        }}
      />
    );

    expect(screen.getByAltText("Open Zaak logo").getAttribute("src")).toBe(
      "https://raw.githubusercontent.com/open-zaak/open-zaak/main/docs/logo.svg"
    );
    expect(screen.getByText("Open Zaak")).toBeTruthy();
    expect(screen.getByText("API's voor Zaakgericht werken")).toBeTruthy();
    expect(screen.queryByText("GitHub description")).toBeNull();
    expect(screen.getByText("Status: stable")).toBeTruthy();
    expect(screen.getByText("Maintenance: contract by Maykin Media")).toBeTruthy();
  });

  it("falls back to the repository description without publiccode.yml details", () => {
    render(<RepoMeta owner="open-zaak" repo="open-zaak" repoMeta={baseMeta} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("GitHub description")).toBeTruthy();
    expect(screen.queryByText(/^Status:/)).toBeNull();
    expect(screen.queryByText("Followed")).toBeNull();
  });

  it("shows the Followed badge for a followed repository", () => {
    render(<RepoMeta owner="open-zaak" repo="open-zaak" repoMeta={baseMeta} followed />);

    expect(screen.getByText("Followed")).toBeTruthy();
  });
});

describe("HistoryPageClient", () => {
  it("shows the logo and display name, and owner/repo without them", () => {
    render(
      <HistoryPageClient
        sort="date"
        direction="desc"
        query=""
        repositories={[
          {
            ...baseSummary,
            displayName: "Open Zaak",
            logoUrl: "https://raw.githubusercontent.com/open-zaak/open-zaak/main/docs/logo.svg",
          },
          { ...baseSummary, id: "other", owner: "example", name: "plain" },
        ]}
      />
    );

    expect(screen.getByAltText("Open Zaak logo")).toBeTruthy();
    expect(screen.getByText("Open Zaak")).toBeTruthy();
    expect(screen.getByText("example/plain")).toBeTruthy();
  });
});
