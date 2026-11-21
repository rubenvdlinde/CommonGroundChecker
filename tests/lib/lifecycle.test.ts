import { describe, expect, it } from "vitest";
import {
  computeLifecycleStatus,
  DECIDED_NOT_SUITABLE_NOTE,
  DECIDED_TERM_PASSED_NOTE,
  formatLifecycleDate,
  isLifecycleStatus,
  LIFECYCLE_STATUSES,
  NO_OPEN_DROPS,
  openDropsOf,
  type LifecycleInput,
} from "@/lib/lifecycle";
import { withAdoptionConditions } from "@/lib/ratings";

const today = "2026-11-19";
const validSla = { party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" };
const decision = { since: "2026-06-01", decision: "https://vng.nl/besluiten/beheer-open-zaak" };

/** A component that meets every condition for Maintained, with no open drops. */
function input(overrides: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    hasAnalysis: true,
    endorsement: { passed: true, reasons: [] },
    developmentStatus: "stable",
    slas: [validSla],
    today,
    decision,
    drops: NO_OPEN_DROPS,
    ...overrides,
  };
}

const openDrop = { open: 1, overdue: 0, nextFixBy: "2026-11-26T23:59:59Z" };
const overdueDrop = { open: 1, overdue: 1, nextFixBy: "2026-11-12T23:59:59Z" };
const lostVerdict = { passed: false, reasons: ["Overall rating below 2.5"] };

describe("lifecycle statuses", () => {
  it("lists the four statuses in lifecycle order and recognises only those", () => {
    expect(LIFECYCLE_STATUSES).toEqual(["listed", "measured", "suitable", "maintained"]);
    expect(isLifecycleStatus("retired")).toBe(false);
    expect(isLifecycleStatus("maintained")).toBe(true);
    expect(isLifecycleStatus("approved")).toBe(false);
    expect(isLifecycleStatus(undefined)).toBe(false);
  });

  it("formats a date and a date-time as a Dutch day", () => {
    expect(formatLifecycleDate("2026-11-26")).toBe("26-11-2026");
    expect(formatLifecycleDate("2026-11-26T23:30:00Z")).toBe("27-11-2026");
  });
});

describe("computeLifecycleStatus", () => {
  it("is Listed while no completed analysis is stored", () => {
    const result = computeLifecycleStatus(input({ hasAnalysis: false, endorsement: null }));
    expect(result.status).toBe("listed");
    expect(result.label).toBe("Listed");
    expect(result.reasons).toEqual(["Not measured yet"]);
  });

  it("is Listed when the analysis stored no verdict", () => {
    expect(computeLifecycleStatus(input({ endorsement: null })).status).toBe("listed");
  });

  it("goes from Listed to Measured when an analysis does not reach the verdict", () => {
    const result = computeLifecycleStatus(input({ endorsement: lostVerdict }));
    expect(result.status).toBe("measured");
    expect(result.reasons).toEqual(["Overall rating below 2.5"]);
  });

  it("gives a reason for Measured when the verdict has none", () => {
    expect(computeLifecycleStatus(input({ endorsement: { passed: false, reasons: [] } })).reasons).toEqual([
      "The verdict does not hold",
    ]);
  });

  it("goes from Measured to Suitable when the verdict holds, with why it is not Maintained", () => {
    const result = computeLifecycleStatus(input({ decision: null }));
    expect(result.status).toBe("suitable");
    expect(result.label).toBe("Suitable for Common Ground");
    expect(result.reasons).toEqual(["No VNG decision to take it into management"]);
    expect(result.decision).toBeNull();
  });

  it("is at most Suitable without a decision, whatever its SLA", () => {
    for (const slas of [[validSla], [], [{ ...validSla, until: "2026-01-01" }]]) {
      expect(computeLifecycleStatus(input({ decision: null, slas })).status).toBe("suitable");
    }
  });

  it("is not Maintained with a decision when the verdict never held", () => {
    const result = computeLifecycleStatus(input({ endorsement: lostVerdict }));
    expect(result.status).toBe("measured");
    expect(result.note).toBe(DECIDED_NOT_SUITABLE_NOTE);
    expect(result.decision).toEqual(decision);
  });

  it("stays Measured for a beta component, since Suitable already asks stable", () => {
    const verdict = withAdoptionConditions({ passed: true, reasons: [] }, { developmentStatus: "beta", declaredUserCount: 2 });
    const result = computeLifecycleStatus(input({ endorsement: verdict, developmentStatus: "beta" }));
    expect(result.status).toBe("measured");
    expect(result.reasons).toEqual(["publiccode.yml developmentStatus is beta; Suitable needs stable"]);
  });

  it("stays Maintained with a fix term when the SLA after the decision expired", () => {
    const result = computeLifecycleStatus(input({ slas: [{ ...validSla, until: "2026-11-10" }] }));
    expect(result.status).toBe("maintained");
    expect(result.note).toBe("No valid SLA, fix by 11-12-2026");
  });

  it("stays Maintained with a fix term from the decision when no SLA was agreed yet", () => {
    const result = computeLifecycleStatus(input({ slas: [], decision: { ...decision, since: "2026-11-01" } }));
    expect(result.status).toBe("maintained");
    expect(result.note).toBe("No valid SLA, fix by 01-12-2026");
  });

  it("falls back to Suitable when the fix term of the missing SLA passed, and keeps the decision", () => {
    const result = computeLifecycleStatus(input({ slas: [] }));
    expect(result.status).toBe("suitable");
    expect(result.reasons).toEqual(["No valid SLA since 01-06-2026; the fix term ended on 01-07-2026"]);
    expect(result.note).toBe(DECIDED_TERM_PASSED_NOTE);
    expect(result.decision).toEqual(decision);
  });

  it("goes from Suitable to Maintained with the verdict, a VNG decision and a valid SLA", () => {
    const result = computeLifecycleStatus(input());
    expect(result.status).toBe("maintained");
    expect(result.reasons).toEqual([]);
    expect(result.note).toBeNull();
    expect(result.decision).toEqual(decision);
  });

  it("stays Maintained with a note while a drop is open within its fix term", () => {
    const result = computeLifecycleStatus(input({ drops: openDrop }));
    expect(result.status).toBe("maintained");
    expect(result.note).toBe("Open drop, fix by 27-11-2026");
  });

  it("stays Maintained while a drop that cost the verdict is within its fix term", () => {
    const result = computeLifecycleStatus(input({ endorsement: lostVerdict, drops: openDrop }));
    expect(result.status).toBe("maintained");
    expect(result.note).toBe("Open drop, fix by 27-11-2026");
  });

  it("goes back from Maintained to Suitable once a fix term has passed", () => {
    const result = computeLifecycleStatus(input({ drops: overdueDrop }));
    expect(result.status).toBe("suitable");
    expect(result.reasons).toEqual(["1 drop is past the fix term"]);
    expect(computeLifecycleStatus(input({ drops: { open: 2, overdue: 2, nextFixBy: null } })).reasons).toEqual([
      "2 drops are past the fix term",
    ]);
  });

  it("goes back from Maintained to Measured once a fix term has passed and the verdict is lost too", () => {
    const result = computeLifecycleStatus(input({ endorsement: lostVerdict, drops: overdueDrop }));
    expect(result.status).toBe("measured");
    expect(result.reasons).toEqual(["Overall rating below 2.5"]);
    expect(result.note).toBe(DECIDED_NOT_SUITABLE_NOTE);
    expect(result.decision).toEqual(decision);
  });

  it("does not keep a lost verdict at Maintained when the SLA term passed too", () => {
    const result = computeLifecycleStatus(input({ endorsement: lostVerdict, drops: openDrop, slas: [] }));
    expect(result.status).toBe("measured");
  });

  it("does not keep a component at Maintained during a fix term when it left stable", () => {
    const leftStable = withAdoptionConditions(lostVerdict, { developmentStatus: "beta", declaredUserCount: 2 });
    const result = computeLifecycleStatus(input({ endorsement: leftStable, developmentStatus: "beta", drops: openDrop }));
    expect(result.status).toBe("measured");
  });

  it("treats an obsolete component as not suitable, with the verdict reason", () => {
    const verdict = withAdoptionConditions({ passed: true, reasons: [] }, { developmentStatus: "obsolete", declaredUserCount: 2 });
    const result = computeLifecycleStatus(input({ endorsement: verdict, developmentStatus: "obsolete" }));
    expect(result.status).toBe("measured");
    expect(result.reasons).toEqual(["publiccode.yml developmentStatus is obsolete; Suitable needs stable"]);
  });
});

describe("openDropsOf", () => {
  it("counts the open and overdue drops and takes the earliest fix-by date", () => {
    expect(
      openDropsOf([
        { resolvedAt: null, overdue: false, fixBy: "2026-12-01T00:00:00Z" },
        { resolvedAt: null, overdue: true, fixBy: "2026-11-10T00:00:00Z" },
        { resolvedAt: "2026-11-15T00:00:00Z", overdue: false, fixBy: "2026-11-01T00:00:00Z" },
      ])
    ).toEqual({ open: 2, overdue: 1, nextFixBy: "2026-11-10T00:00:00Z" });
    expect(openDropsOf([])).toEqual(NO_OPEN_DROPS);
  });
});
