import { describe, expect, it } from "vitest";
import {
  computeApproval,
  declaredUsersOf,
  developmentStatusOf,
  DEFAULT_MIN_CONFIRMED_USERS,
  isSlaValid,
  minConfirmedUsers,
  type ApprovalInput,
} from "@/lib/approval";
import type { CheckResult } from "@/lib/types";

const today = "2026-11-19";
const validSla = { party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" };

function input(overrides: Partial<ApprovalInput> = {}): ApprovalInput {
  return {
    endorsement: { passed: true, reasons: [] },
    developmentStatus: "stable",
    confirmedUserCount: 2,
    slas: [validSla],
    minConfirmedUsers: 2,
    today,
    ...overrides,
  };
}

describe("minConfirmedUsers", () => {
  it("defaults to 2", () => {
    expect(DEFAULT_MIN_CONFIRMED_USERS).toBe(2);
    expect(minConfirmedUsers(undefined)).toBe(2);
    expect(minConfirmedUsers("")).toBe(2);
  });

  it("reads a whole number of at least 1", () => {
    expect(minConfirmedUsers(" 3 ")).toBe(3);
    expect(minConfirmedUsers("1")).toBe(1);
  });

  it.each(["0", "-1", "2.5", "two"])("falls back to the default for %s", (value) => {
    expect(minConfirmedUsers(value)).toBe(2);
  });
});

describe("declaredUsersOf", () => {
  it("reads usedBy from the publiccode result", () => {
    const results = [
      { id: "license" },
      { id: "publiccode", publiccode: { usedBy: ["Utrecht", "Tilburg"] } },
    ] as unknown as CheckResult[];
    expect(declaredUsersOf(results)).toEqual(["Utrecht", "Tilburg"]);
  });

  it("is empty without publiccode.yml", () => {
    expect(declaredUsersOf([{ id: "publiccode" } as unknown as CheckResult])).toEqual([]);
  });
});

describe("developmentStatusOf", () => {
  it("reads developmentStatus from the stored publiccode result", () => {
    expect(developmentStatusOf([{ id: "license" }, { id: "publiccode", publiccode: { developmentStatus: " beta " } }])).toBe("beta");
  });

  it("is null without publiccode.yml, without the field, or for results that are not a list", () => {
    expect(developmentStatusOf([{ id: "publiccode" }])).toBeNull();
    expect(developmentStatusOf([{ id: "publiccode", publiccode: { developmentStatus: null } }])).toBeNull();
    expect(developmentStatusOf(undefined)).toBeNull();
  });
});

describe("isSlaValid", () => {
  it("is valid up to and including its until day", () => {
    expect(isSlaValid({ until: "2026-11-20" }, today)).toBe(true);
    expect(isSlaValid({ until: today }, today)).toBe(true);
    expect(isSlaValid({ until: "2026-11-18" }, today)).toBe(false);
  });
});

describe("computeApproval", () => {
  it("approves a suitable component with enough confirmed users and a valid SLA", () => {
    expect(computeApproval(input())).toEqual({ approved: true, reasons: [], sla: validSla });
  });

  it("is not approved when the component is not suitable", () => {
    const approval = computeApproval(input({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } }));
    expect(approval.approved).toBe(false);
    expect(approval.reasons).toEqual(["Not yet suitable for Common Ground"]);
  });

  it("approves a stable component, whatever the case of the value", () => {
    expect(computeApproval(input({ developmentStatus: "Stable" })).approved).toBe(true);
  });

  it.each(["beta", "development", "concept", "obsolete"])("does not approve a %s component", (status) => {
    const approval = computeApproval(input({ developmentStatus: status }));
    expect(approval.approved).toBe(false);
    expect(approval.reasons).toEqual([`development status is ${status}, only stable components can be approved`]);
  });

  it("does not approve when publiccode.yml declares no development status", () => {
    expect(computeApproval(input({ developmentStatus: null })).reasons).toEqual([
      "development status is not declared, only stable components can be approved",
    ]);
  });

  it("names the confirmed users against the minimum", () => {
    expect(computeApproval(input({ confirmedUserCount: 1 })).reasons).toEqual(["1 of 2 confirmed users"]);
    expect(computeApproval(input({ confirmedUserCount: 2, minConfirmedUsers: 3 })).reasons).toEqual([
      "2 of 3 confirmed users",
    ]);
  });

  it("approves with more confirmed users than the minimum", () => {
    expect(computeApproval(input({ confirmedUserCount: 5 })).approved).toBe(true);
  });

  it("says when the users were not counted", () => {
    expect(computeApproval(input({ confirmedUserCount: null })).reasons).toEqual([
      "Confirmed users not counted yet: the latest scan did not record usedBy",
    ]);
  });

  it("says when there is no SLA", () => {
    expect(computeApproval(input({ slas: [] })).reasons).toEqual(["No SLA"]);
  });

  it("names the latest end date when every SLA expired", () => {
    const approval = computeApproval(
      input({
        slas: [
          { ...validSla, until: "2025-06-30" },
          { ...validSla, until: "2026-11-18" },
        ],
      })
    );
    expect(approval.reasons).toEqual(["SLA expired on 2026-11-18"]);
    expect(approval.sla).toBeNull();
  });

  it("uses a valid SLA next to an expired one", () => {
    const approval = computeApproval(input({ slas: [{ ...validSla, until: "2025-01-01" }, validSla] }));
    expect(approval.approved).toBe(true);
    expect(approval.sla).toEqual(validSla);
  });

  it("lists every missing condition in order", () => {
    const approval = computeApproval(
      input({ endorsement: { passed: false, reasons: [] }, developmentStatus: "beta", confirmedUserCount: 0, slas: [] })
    );
    expect(approval.reasons).toEqual([
      "Not yet suitable for Common Ground",
      "development status is beta, only stable components can be approved",
      "0 of 2 confirmed users",
      "No SLA",
    ]);
  });
});
