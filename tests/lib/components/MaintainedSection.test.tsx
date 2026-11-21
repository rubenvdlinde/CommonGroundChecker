/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import MaintainedSection from "@/components/MaintainedSection";
import { deleteSla, postSla, type UsageStatus } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({
  postSla: vi.fn(),
  deleteSla: vi.fn(),
}));

const mocked = {
  postSla: postSla as unknown as ReturnType<typeof vi.fn>,
  deleteSla: deleteSla as unknown as ReturnType<typeof vi.fn>,
};

const suitable = { passed: true, reasons: [] };
const today = "2026-11-19";
const decision = { since: "2026-06-01", decision: "https://vng.nl/besluiten/beheer-open-zaak" };

const usage = {
  declaredUsers: ["Gemeente Utrecht"],
  declaredUserCount: 1,
  slas: [],
};

const sla = {
  id: "s1",
  party: "Gemeente Utrecht",
  maintainer: "Maykin Media",
  startsOn: "2026-01-01",
  until: "2027-12-31",
  link: "https://example.org/sla",
};

const twoUsers = { declaredUsers: ["Gemeente Utrecht", "Gemeente Den Haag"], declaredUserCount: 2 };

function renderSection(overrides: Partial<Parameters<typeof MaintainedSection>[0]> = {}) {
  return render(
    <MaintainedSection
      repoId="repo-id"
      endorsement={suitable}
      decision={decision}
      initialUsage={usage}
      minUsers={2}
      today={today}
      {...overrides}
    />
  );
}

function maintainedRow() {
  return within(screen.getByRole("list", { name: "Levels" })).getAllByRole("listitem")[0];
}

describe("MaintainedSection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows Maintained above Suitable, with the reasons Maintained is not reached", () => {
    renderSection({ decision: null, initialUsage: { ...usage, slas: [sla] } });

    const levels = within(screen.getByRole("list", { name: "Levels" })).getAllByRole("listitem");
    expect(levels[0].textContent).toContain("Maintained");
    expect(levels[0].textContent).toContain("Not reached");
    expect(levels[levels.length - 1].textContent).toContain("names at least 2 organisations under usedBy");
    expect(levels[levels.length - 1].textContent).toContain("Suitable for Common Ground");
    expect(levels[levels.length - 1].textContent).toContain("Reached");
    expect(levels[levels.length - 1].textContent).toContain(
      "the threshold the Common Ground programme uses to decide whether to adopt a component as supported"
    );
    expect(levels[levels.length - 1].textContent).not.toMatch(/advice/i);
    expect(screen.getByRole("heading", { level: 3, name: "Level" })).toBeTruthy();
    const reasons = screen.getByRole("list", { name: "Why it is not yet Maintained" });
    expect(reasons.textContent).toBe("No VNG decision to take it into management");
    expect(screen.getByText(/Suitable for Common Ground needs developmentStatus stable and at least 2 organisations/)).toBeTruthy();
    expect(levels[0].textContent).toContain("a decision by VNG to take the component into management");
    expect(levels[0].textContent).toContain("follows the decision");
    expect(screen.getByRole("link", { name: "config/repositories.yml" })).toBeTruthy();
    expect(screen.getByText(/never gives stars/)).toBeTruthy();
  });

  it("leaves out the admin form when read-only, and points to config/slas.yml", () => {
    renderSection({ readOnly: true, initialUsage: { ...twoUsers, slas: [sla] } });
    expect(screen.queryByText("Record SLAs (admin)")).toBeNull();
    expect(screen.queryByLabelText("Admin token")).toBeNull();
    expect(screen.getByRole("link", { name: "config/slas.yml" }).getAttribute("href")).toMatch(/config\/slas\.yml$/);
    expect(screen.getByRole("list", { name: "SLAs" }).textContent).toContain("Gemeente Utrecht with Maykin Media");
  });

  it("lists the declared users as self-declared", () => {
    renderSection();

    expect(screen.getByText("1 organisation named under usedBy in publiccode.yml.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Declared users" }).textContent).toBe("Gemeente Utrecht");
    expect(screen.getByText(/self-declared/)).toBeTruthy();
    expect(screen.queryByText(/confirm/i)).toBeNull();
  });

  it("reaches Maintained with a valid SLA", () => {
    renderSection({ initialUsage: { ...twoUsers, slas: [sla] } });

    expect(maintainedRow().textContent).toContain("Reached");
    expect(maintainedRow().textContent).toContain("Decided on 2026-06-01.");
    expect(maintainedRow().textContent).toContain("SLA: Gemeente Utrecht with Maykin Media, until 2027-12-31.");
    expect(screen.queryByRole("list", { name: "Why it is not yet Maintained" })).toBeNull();
  });

  it("does not reach Maintained when the component is not suitable", () => {
    renderSection({
      endorsement: { passed: false, reasons: ["publiccode.yml developmentStatus is beta; Suitable needs stable"] },
      initialUsage: { ...twoUsers, slas: [sla] },
    });

    const reasons = screen.getByRole("list", { name: "Why it is not yet Maintained" });
    expect(reasons.textContent).toBe("Not yet suitable for Common Ground");
  });

  it("keeps Maintained during the fix term of an expired SLA, and drops it after the term", () => {
    renderSection({ initialUsage: { ...twoUsers, slas: [{ ...sla, until: "2026-11-10" }] } });
    expect(maintainedRow().textContent).toContain("Reached");
    expect(maintainedRow().textContent).toContain("No valid SLA, fix by 11-12-2026.");

    cleanup();
    renderSection({ initialUsage: { ...twoUsers, slas: [{ ...sla, until: "2026-06-30" }] } });
    expect(screen.getByRole("list", { name: "Why it is not yet Maintained" }).textContent).toBe(
      "No valid SLA since 01-07-2026; the fix term ended on 31-07-2026"
    );
    expect(screen.getByRole("list", { name: "SLAs" }).textContent).toContain("expired");
  });

  it("is not Maintained without a decision, even with a valid SLA", () => {
    renderSection({ decision: null, initialUsage: { ...twoUsers, slas: [sla] } });
    expect(maintainedRow().textContent).toContain("Not reached");
  });

  it("lists why the component is not suitable under Suitable", () => {
    renderSection({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } });

    expect(screen.getByRole("list", { name: "Why it is not yet suitable" }).textContent).toContain(
      "Overall rating below 2.5"
    );
    expect(screen.getByRole("list", { name: "Why it is not yet Maintained" }).textContent).toContain(
      "Not yet suitable for Common Ground"
    );
  });

  it("adds an SLA with the admin token, leaves out an empty link and updates the level", async () => {
    mocked.postSla.mockResolvedValueOnce({ ...twoUsers, slas: [sla] });
    renderSection({ initialUsage: { ...twoUsers, slas: [] } });

    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    expect(screen.getByLabelText("Party").getAttribute("value")).toBe("");
    expect(screen.getByText(/Who contracts the maintainer, usually a municipality, on the VNG model contract/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Party"), { target: { value: "Gemeente Utrecht" } });
    fireEvent.change(screen.getByLabelText("Maintainer"), { target: { value: "Maykin Media" } });
    fireEvent.change(screen.getByLabelText("Until"), { target: { value: "2027-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Add SLA" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("SLA saved.");
    });
    expect(mocked.postSla).toHaveBeenCalledWith(
      "repo-id",
      { party: "Gemeente Utrecht", maintainer: "Maykin Media", startsOn: today, until: "2027-12-31", link: undefined },
      "secret"
    );
    expect(screen.getByRole("list", { name: "SLAs" }).textContent).toContain("Gemeente Utrecht with Maykin Media");
    expect(maintainedRow().textContent).toContain("Reached");
  });

  it("removes an SLA", async () => {
    mocked.deleteSla.mockResolvedValueOnce({ ...usage, slas: [] });
    renderSection({ initialUsage: { ...usage, slas: [sla] } });

    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove SLA of Gemeente Utrecht with Maykin Media until 2027-12-31" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("SLA removed.");
    });
    expect(mocked.deleteSla).toHaveBeenCalledWith("repo-id", "s1", "secret");
    expect(screen.getByText("No SLA recorded.")).toBeTruthy();
  });

  it.each([
    [{ status: 401 }, "The admin token is not valid."],
    [{ status: 503 }, "Admin actions are disabled on the backend (ADMIN_TOKEN is not configured)."],
    [{ status: 400, body: { error: "Invalid until: the SLA ends before it starts." } }, "Invalid until: the SLA ends before it starts."],
  ])("shows the backend error %o", async (error, text) => {
    mocked.postSla.mockRejectedValueOnce(Object.assign(new Error("failed"), error));
    renderSection();

    fireEvent.change(screen.getByLabelText("Party"), { target: { value: "Gemeente Utrecht" } });
    fireEvent.change(screen.getByLabelText("Maintainer"), { target: { value: "Maykin Media" } });
    fireEvent.change(screen.getByLabelText("Until"), { target: { value: "2025-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Add SLA" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(text);
    });
  });

  it("says when the latest scan did not count the users", () => {
    renderSection({
      initialUsage: { ...usage, declaredUsers: null, declaredUserCount: null } as unknown as UsageStatus,
    });

    expect(screen.getByText(/did not record the users in publiccode.yml/)).toBeTruthy();
  });

  it("says when the usage could not be loaded", () => {
    renderSection({ initialUsage: null });

    expect(screen.getByText("Usage could not be loaded from the backend.")).toBeTruthy();
  });

  it("links each declared user that has an organisation page, and shows the others as text", () => {
    renderSection({
      initialUsage: { ...twoUsers, slas: [] },
      organisationSlugs: { "gemeente utrecht": "gemeente-utrecht" },
    });

    const users = screen.getByRole("list", { name: "Declared users" });
    expect(within(users).getByRole("link", { name: "Gemeente Utrecht" }).getAttribute("href")).toBe(
      "/users/gemeente-utrecht"
    );
    expect(within(users).queryByRole("link", { name: "Gemeente Den Haag" })).toBeNull();
    expect(users.textContent).toContain("Gemeente Den Haag");
  });
});
