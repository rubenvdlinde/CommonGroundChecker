/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ApprovalSection from "@/components/ApprovalSection";
import {
  deleteSla,
  deleteUserConfirmation,
  postSla,
  postUserConfirmation,
  type UsageStatus,
} from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({
  postUserConfirmation: vi.fn(),
  deleteUserConfirmation: vi.fn(),
  postSla: vi.fn(),
  deleteSla: vi.fn(),
}));

const mocked = {
  postUserConfirmation: postUserConfirmation as unknown as ReturnType<typeof vi.fn>,
  deleteUserConfirmation: deleteUserConfirmation as unknown as ReturnType<typeof vi.fn>,
  postSla: postSla as unknown as ReturnType<typeof vi.fn>,
  deleteSla: deleteSla as unknown as ReturnType<typeof vi.fn>,
};

const suitable = { passed: true, reasons: [] };
const today = "2026-11-19";

const usage = {
  declaredUsers: ["Utrecht", "Den Haag", "Tilburg"],
  declaredUserCount: 3,
  confirmedUserCount: 1,
  confirmations: [
    {
      id: "c1",
      organisation: "Utrecht",
      confirmedOn: "2026-11-01",
      source: "https://example.org/letter",
      method: "written-confirmation",
      declared: true,
    },
    {
      id: "c2",
      organisation: "Amsterdam",
      confirmedOn: "2026-11-02",
      source: "https://example.org/register",
      method: "register-entry",
      declared: false,
    },
  ],
  slas: [],
};

const sla = { id: "s1", party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31", link: "https://example.org/sla" };

function renderSection(overrides: Partial<Parameters<typeof ApprovalSection>[0]> = {}) {
  return render(
    <ApprovalSection
      repoId="repo-id"
      endorsement={suitable}
      initialUsage={usage}
      minConfirmedUsers={2}
      today={today}
      {...overrides}
    />
  );
}

describe("ApprovalSection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows Approved above Suitable, with the reasons Approved is not reached", () => {
    renderSection();

    const levels = within(screen.getByRole("list", { name: "Levels" })).getAllByRole("listitem");
    expect(levels[0].textContent).toContain("Approved");
    expect(levels[0].textContent).toContain("Not reached");
    expect(levels[levels.length - 1].textContent).toContain("Suitable for Common Ground");
    expect(levels[levels.length - 1].textContent).toContain("Reached");
    const reasons = screen.getByRole("list", { name: "Why it is not approved" });
    expect(reasons.textContent).toContain("1 of 2 confirmed users");
    expect(reasons.textContent).toContain("No SLA");
    expect(screen.getByText(/is a proposal/)).toBeTruthy();
    expect(screen.getByText(/never gives stars/)).toBeTruthy();
  });

  it("shows the counts and marks a confirmation that usedBy does not name", () => {
    renderSection();

    expect(screen.getByText("3 organisations named under usedBy in publiccode.yml, 1 confirmed.")).toBeTruthy();
    const confirmed = screen.getByRole("list", { name: "Confirmed users" });
    expect(confirmed.textContent).toContain("Written confirmation, 2026-11-01");
    expect(confirmed.textContent).toContain("Amsterdam");
    expect(confirmed.textContent).toContain("not named under usedBy, so not counted");
  });

  it("reaches Approved with enough confirmed users and a valid SLA", () => {
    renderSection({ initialUsage: { ...usage, confirmedUserCount: 2, slas: [sla] } });

    const approved = within(screen.getByRole("list", { name: "Levels" })).getAllByRole("listitem")[0];
    expect(approved.textContent).toContain("Reached");
    expect(approved.textContent).toContain("SLA: VNG with Maykin Media, until 2027-12-31.");
    expect(screen.queryByRole("list", { name: "Why it is not approved" })).toBeNull();
  });

  it("names the end date of an expired SLA", () => {
    renderSection({ initialUsage: { ...usage, confirmedUserCount: 2, slas: [{ ...sla, until: "2026-06-30" }] } });

    expect(screen.getByRole("list", { name: "Why it is not approved" }).textContent).toContain(
      "SLA expired on 2026-06-30"
    );
    expect(screen.getByRole("list", { name: "SLAs" }).textContent).toContain("expired");
  });

  it("lists why the component is not suitable under Suitable", () => {
    renderSection({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } });

    expect(screen.getByRole("list", { name: "Why it is not yet suitable" }).textContent).toContain(
      "Overall rating below 2.5"
    );
    expect(screen.getByRole("list", { name: "Why it is not approved" }).textContent).toContain(
      "Not yet suitable for Common Ground"
    );
  });

  it("adds a confirmation with the admin token and updates the level", async () => {
    mocked.postUserConfirmation.mockResolvedValueOnce({ ...usage, confirmedUserCount: 2, slas: [sla] });
    renderSection();

    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText("Organisation"), { target: { value: "Den Haag" } });
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "register-entry" } });
    fireEvent.change(screen.getByLabelText("Source link"), { target: { value: "https://example.org/den-haag" } });
    fireEvent.click(screen.getByRole("button", { name: "Add confirmation" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Confirmation of Den Haag saved.");
    });
    expect(mocked.postUserConfirmation).toHaveBeenCalledWith(
      "repo-id",
      {
        organisation: "Den Haag",
        confirmedOn: today,
        source: "https://example.org/den-haag",
        method: "register-entry",
      },
      "secret"
    );
    expect(within(screen.getByRole("list", { name: "Levels" })).getAllByRole("listitem")[0].textContent).toContain(
      "Reached"
    );
    expect((screen.getByLabelText("Organisation") as HTMLInputElement).value).toBe("");
  });

  it("offers the declared organisations as suggestions", () => {
    const { container } = renderSection();
    const options = Array.from(container.querySelectorAll("datalist option")).map((option) =>
      option.getAttribute("value")
    );
    expect(options).toEqual(["Utrecht", "Den Haag", "Tilburg"]);
  });

  it("removes a confirmation", async () => {
    mocked.deleteUserConfirmation.mockResolvedValueOnce({ ...usage, confirmations: [usage.confirmations[0]] });
    renderSection();

    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove confirmation of Amsterdam" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Confirmation of Amsterdam removed.");
    });
    expect(mocked.deleteUserConfirmation).toHaveBeenCalledWith("repo-id", "c2", "secret");
    expect(screen.queryByText("Amsterdam")).toBeNull();
  });

  it("adds an SLA and leaves out an empty link", async () => {
    mocked.postSla.mockResolvedValueOnce({ ...usage, slas: [sla] });
    renderSection();

    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText("Maintainer"), { target: { value: "Maykin Media" } });
    fireEvent.change(screen.getByLabelText("Until"), { target: { value: "2027-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Add SLA" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("SLA saved.");
    });
    expect(mocked.postSla).toHaveBeenCalledWith(
      "repo-id",
      { party: "VNG", maintainer: "Maykin Media", startsOn: today, until: "2027-12-31", link: undefined },
      "secret"
    );
    expect(screen.getByRole("list", { name: "SLAs" }).textContent).toContain("VNG with Maykin Media");
  });

  it("removes an SLA", async () => {
    mocked.deleteSla.mockResolvedValueOnce({ ...usage, slas: [] });
    renderSection({ initialUsage: { ...usage, slas: [sla] } });

    fireEvent.click(screen.getByRole("button", { name: "Remove SLA of VNG with Maykin Media until 2027-12-31" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("SLA removed.");
    });
    expect(screen.getByText("No SLA recorded.")).toBeTruthy();
  });

  it.each([
    [{ status: 401 }, "The admin token is not valid."],
    [{ status: 503 }, "Admin actions are disabled on the backend (ADMIN_TOKEN is not configured)."],
    [{ status: 409, body: { error: "Utrecht is already confirmed for this repository." } }, "Utrecht is already confirmed for this repository."],
  ])("shows the backend error %o", async (error, text) => {
    mocked.postUserConfirmation.mockRejectedValueOnce(Object.assign(new Error("failed"), error));
    renderSection();

    fireEvent.change(screen.getByLabelText("Organisation"), { target: { value: "Utrecht" } });
    fireEvent.change(screen.getByLabelText("Source link"), { target: { value: "https://example.org/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add confirmation" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(text);
    });
  });

  it("says when the latest scan did not count the users", () => {
    renderSection({
      initialUsage: {
        ...usage,
        declaredUsers: null,
        declaredUserCount: null,
        confirmedUserCount: null,
      } as unknown as UsageStatus,
    });

    expect(screen.getByText(/did not record the users in publiccode.yml/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Why it is not approved" }).textContent).toContain(
      "Confirmed users not counted yet"
    );
  });
});
