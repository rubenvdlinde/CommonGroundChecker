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
      developmentStatus="stable"
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
    renderSection();

    const levels = within(screen.getByRole("list", { name: "Levels" })).getAllByRole("listitem");
    expect(levels[0].textContent).toContain("Maintained");
    expect(levels[0].textContent).toContain("Not reached");
    expect(levels[0].textContent).toContain("at least 2 organisations declared in publiccode.yml");
    expect(levels[levels.length - 1].textContent).toContain("Suitable for Common Ground");
    expect(levels[levels.length - 1].textContent).toContain("Reached");
    expect(levels[levels.length - 1].textContent).toContain(
      "the threshold the Common Ground programme uses to decide whether to adopt a component as supported"
    );
    expect(levels[levels.length - 1].textContent).not.toMatch(/advice/i);
    expect(screen.getByRole("heading", { level: 3, name: "Level" })).toBeTruthy();
    const reasons = screen.getByRole("list", { name: "Why it is not yet Maintained" });
    expect(reasons.textContent).toContain("1 of 2 users declared in publiccode.yml");
    expect(reasons.textContent).toContain("No SLA");
    expect(screen.getByText(/The minimum of 2 organisations declared in publiccode.yml follows the Common Ground standard/)).toBeTruthy();
    expect(levels[0].textContent).toContain("a valid SLA with a maintainer, on the VNG model contract");
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

  it("reaches Maintained with enough declared users and a valid SLA", () => {
    renderSection({ initialUsage: { ...twoUsers, slas: [sla] } });

    expect(maintainedRow().textContent).toContain("Reached");
    expect(maintainedRow().textContent).toContain("SLA: Gemeente Utrecht with Maykin Media, until 2027-12-31.");
    expect(screen.queryByRole("list", { name: "Why it is not yet Maintained" })).toBeNull();
  });

  it("does not reach Maintained for a component that is not stable", () => {
    renderSection({ developmentStatus: "beta", initialUsage: { ...twoUsers, slas: [sla] } });

    const reasons = screen.getByRole("list", { name: "Why it is not yet Maintained" });
    expect(reasons.textContent).toBe("development status is beta, only a stable component can be Maintained");
  });

  it("names the end date of an expired SLA", () => {
    renderSection({ initialUsage: { ...twoUsers, slas: [{ ...sla, until: "2026-06-30" }] } });

    expect(screen.getByRole("list", { name: "Why it is not yet Maintained" }).textContent).toBe("SLA expired on 2026-06-30");
    expect(screen.getByRole("list", { name: "SLAs" }).textContent).toContain("expired");
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
    expect(screen.getByRole("list", { name: "Why it is not yet Maintained" }).textContent).toContain(
      "Users not counted yet"
    );
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
      "/organisations/gemeente-utrecht"
    );
    expect(within(users).queryByRole("link", { name: "Gemeente Den Haag" })).toBeNull();
    expect(users.textContent).toContain("Gemeente Den Haag");
  });
});
