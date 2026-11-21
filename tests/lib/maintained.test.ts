import { describe, expect, it } from "vitest";
import {
  computeMaintained,
  declaredUsersOf,
  developmentStatusOf,
  organisationsLabel,
  isSlaValid,
  maintainedDecisionOf,
  slaStateOf,
  type MaintainedInput,
} from "@/lib/maintained";
import { computeEndorsement } from "@/lib/ratings";
import type { CheckResult } from "@/lib/types";

const today = "2026-11-19";
const validSla = { party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" };
const decision = { since: "2026-06-01", decision: "https://vng.nl/besluiten/beheer-open-zaak" };

function input(overrides: Partial<MaintainedInput> = {}): MaintainedInput {
  return {
    endorsement: { passed: true, reasons: [] },
    decision,
    slas: [validSla],
    today,
    ...overrides,
  };
}

describe("organisationsLabel", () => {
  it("counts one organisation and more organisations", () => {
    expect(organisationsLabel(1)).toBe("1 organisation");
    expect(organisationsLabel(2)).toBe("2 organisations");
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

describe("maintainedDecisionOf", () => {
  it("reads a complete decision and nothing else", () => {
    expect(maintainedDecisionOf(decision)).toEqual(decision);
    expect(maintainedDecisionOf({ since: "2026-06-01" })).toBeNull();
    expect(maintainedDecisionOf(null)).toBeNull();
    expect(maintainedDecisionOf("yes")).toBeNull();
  });
});

describe("slaStateOf", () => {
  it("has no fix term while an SLA is valid", () => {
    expect(slaStateOf(decision, [validSla], today)).toEqual({ sla: validSla, missingSince: null, fixBy: null, overdue: false });
  });

  it("starts the fix term at the decision when no SLA was agreed, or when the last one ended before it", () => {
    expect(slaStateOf({ ...decision, since: "2026-11-10" }, [], today)).toMatchObject({
      missingSince: "2026-11-10",
      fixBy: "2026-12-10",
      overdue: false,
    });
    expect(slaStateOf({ ...decision, since: "2026-11-10" }, [{ ...validSla, until: "2025-12-31" }], today)).toMatchObject({
      missingSince: "2026-11-10",
    });
  });

  it("starts the fix term the day after the last SLA ended, and is overdue after it", () => {
    expect(slaStateOf(decision, [{ ...validSla, until: "2026-09-30" }], today)).toMatchObject({
      missingSince: "2026-10-01",
      fixBy: "2026-10-31",
      overdue: true,
    });
  });
});

describe("computeMaintained", () => {
  it("reaches Maintained for a suitable component with a VNG decision and a valid SLA", () => {
    expect(computeMaintained(input())).toEqual({ maintained: true, reasons: [], sla: validSla, decision, note: null });
  });

  it("is not Maintained without a decision, whatever its SLA", () => {
    const level = computeMaintained(input({ decision: null }));
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual(["No VNG decision to take it into management"]);
    expect(level.sla).toEqual(validSla);
  });

  it("is not Maintained when the component is not suitable", () => {
    const level = computeMaintained(input({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } }));
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual(["Not yet suitable for Common Ground"]);
  });

  it("stays Maintained with a note while a missing SLA is within its fix term", () => {
    const level = computeMaintained(input({ slas: [{ ...validSla, until: "2026-11-10" }] }));
    expect(level.maintained).toBe(true);
    expect(level.note).toBe("No valid SLA, fix by 11-12-2026");
    expect(level.sla).toBeNull();
  });

  it("is not Maintained once the fix term of a missing SLA passed", () => {
    const level = computeMaintained(
      input({
        slas: [
          { ...validSla, until: "2025-06-30" },
          { ...validSla, until: "2026-09-30" },
        ],
      })
    );
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual(["No valid SLA since 01-10-2026; the fix term ended on 31-10-2026"]);
    expect(level.decision).toEqual(decision);
  });

  it("uses a valid SLA next to an expired one", () => {
    const level = computeMaintained(input({ slas: [{ ...validSla, until: "2025-01-01" }, validSla] }));
    expect(level.maintained).toBe(true);
    expect(level.sla).toEqual(validSla);
  });

  it("inherits stable and the users from Suitable, without a rule of its own", () => {
    const suitability = computeEndorsement(
      [{ id: "publiccode", status: "pass", publiccode: { developmentStatus: "beta", usedBy: ["Utrecht"] } }],
      5,
      { criterionConfigByCheckId: {} }
    );
    const level = computeMaintained(input({ endorsement: suitability }));
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual(["Not yet suitable for Common Ground"]);
  });

  it("lists every missing condition in order", () => {
    const level = computeMaintained(input({ endorsement: { passed: false, reasons: [] }, decision: null, slas: [] }));
    expect(level.reasons).toEqual(["Not yet suitable for Common Ground", "No VNG decision to take it into management"]);
  });
});
