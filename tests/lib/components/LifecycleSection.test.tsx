/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import LifecycleSection from "@/components/LifecycleSection";
import { computeLifecycleStatus, NO_OPEN_DROPS, type LifecycleInput } from "@/lib/lifecycle";
import type { BasissetMatch } from "@/lib/basisset";


const base: LifecycleInput = {
  hasAnalysis: true,
  endorsement: { passed: true, reasons: [] },
  developmentStatus: "stable",
  slas: [{ party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" }],
  today: "2026-11-19",
  decision: { since: "2026-06-01", decision: "https://vng.nl/besluiten/beheer-open-zaak" },
  drops: NO_OPEN_DROPS,
};

const openZaak: BasissetMatch = {
  listVersion: "0.3.1",
  available: true,
  entries: [{ name: "OpenZaak", status: "g", version: "1.29.0", inBasisset: true, comparison: "newer" }],
  otherAddress: [],
};

function renderSection(input: Partial<LifecycleInput>, basisset: BasissetMatch = openZaak) {
  return render(
    <LifecycleSection
      result={computeLifecycleStatus({ ...base, ...input })}
      basisset={basisset}
      scannedVersion="1.31.2"
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
    expect(within(section).getByText(/VNG decided on 01-06-2026 to take this component into management/)).toBeTruthy();
    expect(within(section).getByRole("link", { name: "Read the decision" }).getAttribute("href")).toBe(
      "https://vng.nl/besluiten/beheer-open-zaak"
    );
    expect(within(section).queryByText(/Retire/)).toBeNull();
  });

  it("lists why a component is not yet at the next status", () => {
    renderSection({ decision: null });
    expect(screen.getByRole("list", { name: "What is missing for Maintained" }).textContent).toBe(
      "No VNG decision to take it into management"
    );
    expect(screen.queryByRole("link", { name: "Read the decision" })).toBeNull();

    cleanup();
    renderSection({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } });
    expect(screen.getByRole("list", { name: "What is missing for Suitable for Common Ground" }).textContent).toBe(
      "Overall rating below 2.5"
    );
  });

  it("keeps the decision recorded when a component with a decision is not suitable now", () => {
    renderSection({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } });
    const section = screen.getByRole("region", { name: "Common Ground status" });
    expect(section.querySelector("[data-lifecycle-status]")?.textContent).toBe("Measured");
    expect(within(section).getByText("Maintained by VNG decision, not suitable now")).toBeTruthy();
    expect(within(section).getByRole("link", { name: "Read the decision" })).toBeTruthy();
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
