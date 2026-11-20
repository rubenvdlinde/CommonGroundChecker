/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import LifecycleSection from "@/components/LifecycleSection";
import { computeLifecycleStatus, NO_OPEN_DROPS, type LifecycleInput } from "@/lib/lifecycle";
import type { BasissetMatch } from "@/lib/basisset";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/apiClient", () => ({ putRepositoryRetire: vi.fn() }));

const base: LifecycleInput = {
  hasAnalysis: true,
  endorsement: { passed: true, reasons: [] },
  developmentStatus: "stable",
  slas: [{ party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" }],
  today: "2026-11-19",
  retiredAt: null,
  retiredReason: null,
  drops: NO_OPEN_DROPS,
};

const openZaak: BasissetMatch = {
  listVersion: "0.3.1",
  available: true,
  entries: [{ name: "OpenZaak", status: "g", version: "1.29.0", inBasisset: true, comparison: "newer" }],
  otherAddress: [],
};

function renderSection(input: Partial<LifecycleInput>, basisset: BasissetMatch = openZaak, adminControls = true) {
  return render(
    <LifecycleSection
      repoId="repo-id"
      result={computeLifecycleStatus({ ...base, ...input })}
      basisset={basisset}
      scannedVersion="1.31.2"
      retiredAt={input.retiredAt ?? null}
      adminControls={adminControls}
    />
  );
}

describe("LifecycleSection", () => {
  afterEach(() => cleanup());

  it("shows Maintained, the open drop note and the basisset entry with the version comparison", () => {
    renderSection({ drops: { open: 1, overdue: 0, nextFixBy: "2026-11-26" } });

    const section = screen.getByRole("region", { name: "Common Ground status" });
    expect(section.querySelector("[data-lifecycle-status]")?.textContent).toBe("Maintained");
    expect(within(section).getByText("Open drop, fix by 26-11-2026")).toBeTruthy();
    expect(within(section).getByRole("list", { name: "Basisset entries" }).textContent).toBe(
      "In the Common Ground basisset as OpenZaak (g), version 1.29.0. The scanned version 1.31.2 is newer than the basisset's 1.29.0."
    );
    expect(within(section).getByRole("link", { name: "See the whole basisset" }).getAttribute("href")).toBe("/basisset");
    expect(within(section).getByText("Retire this component (admin)")).toBeTruthy();
  });

  it("lists why a component is not yet at the next status", () => {
    renderSection({ slas: [] });
    expect(screen.getByRole("list", { name: "What is missing for Maintained" }).textContent).toBe("No SLA");

    cleanup();
    renderSection({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } });
    expect(screen.getByRole("list", { name: "What is missing for Suitable for Common Ground" }).textContent).toBe(
      "Overall rating below 2.5"
    );
  });

  it("says who retired a component and why, and that its history stays", () => {
    renderSection({ retiredAt: "2026-11-19T10:00:00Z", retiredReason: "Replaced by Open Zaak" });
    expect(screen.getByText(/Retired by an admin on 19-11-2026: Replaced by Open Zaak\. The history stays/)).toBeTruthy();

    cleanup();
    renderSection({ developmentStatus: "obsolete" }, openZaak, false);
    expect(screen.getByText(/the scanned publiccode\.yml says developmentStatus: obsolete/)).toBeTruthy();
    expect(screen.queryByText("Retire this component (admin)")).toBeNull();
  });

  it("says when the component is next to the basisset, at another address, or when the list is missing", () => {
    renderSection({}, {
      listVersion: "0.3.1",
      available: true,
      entries: [],
      otherAddress: [{ name: "OpenRegister", repo: "https://codeberg.org/Conduction/openregister" }],
    });
    expect(screen.getByText("Not in the Common Ground basisset.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Basisset entries at another address" }).textContent).toContain(
      "The basisset lists OpenRegister with the same repository name at another address: https://codeberg.org/Conduction/openregister."
    );

    cleanup();
    renderSection({}, { listVersion: null, available: false, entries: [], otherAddress: [] });
    expect(screen.getByText("The Common Ground basisset could not be read just now.")).toBeTruthy();
  });
});
