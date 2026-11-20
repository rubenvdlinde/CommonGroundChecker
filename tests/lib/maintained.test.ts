import { describe, expect, it } from "vitest";
import {
  computeMaintained,
  declaredUsersOf,
  developmentStatusOf,
  organisationsLabel,
  isSlaValid,
  type MaintainedInput,
} from "@/lib/maintained";
import { computeEndorsement } from "@/lib/ratings";
import type { CheckResult } from "@/lib/types";

const today = "2026-11-19";
const validSla = { party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" };

function input(overrides: Partial<MaintainedInput> = {}): MaintainedInput {
  return {
    endorsement: { passed: true, reasons: [] },
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

describe("computeMaintained", () => {
  it("reaches Maintained for a suitable component with a valid SLA", () => {
    expect(computeMaintained(input())).toEqual({ maintained: true, reasons: [], sla: validSla });
  });

  it("is not Maintained when the component is not suitable", () => {
    const level = computeMaintained(input({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } }));
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual(["Not yet suitable for Common Ground"]);
  });

  it("says when there is no SLA", () => {
    expect(computeMaintained(input({ slas: [] })).reasons).toEqual(["No SLA"]);
  });

  it("names the latest end date when every SLA expired", () => {
    const level = computeMaintained(
      input({
        slas: [
          { ...validSla, until: "2025-06-30" },
          { ...validSla, until: "2026-11-18" },
        ],
      })
    );
    expect(level.reasons).toEqual(["SLA expired on 2026-11-18"]);
    expect(level.sla).toBeNull();
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
    const level = computeMaintained(input({ endorsement: { passed: false, reasons: [] }, slas: [] }));
    expect(level.reasons).toEqual(["Not yet suitable for Common Ground", "No SLA"]);
  });
});
