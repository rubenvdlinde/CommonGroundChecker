import { describe, expect, it } from "vitest";
import {
  computeMaintained,
  declaredUsersOf,
  developmentStatusOf,
  DEFAULT_MIN_USERS,
  organisationsLabel,
  isSlaValid,
  minUsers,
  type MaintainedInput,
} from "@/lib/maintained";
import type { CheckResult } from "@/lib/types";

const today = "2026-11-19";
const validSla = { party: "VNG", maintainer: "Maykin Media", startsOn: "2026-01-01", until: "2027-12-31" };

function input(overrides: Partial<MaintainedInput> = {}): MaintainedInput {
  return {
    endorsement: { passed: true, reasons: [] },
    developmentStatus: "stable",
    declaredUserCount: 2,
    slas: [validSla],
    minUsers: 2,
    today,
    ...overrides,
  };
}

describe("minUsers", () => {
  it("defaults to 1, as the Common Ground standard asks", () => {
    expect(DEFAULT_MIN_USERS).toBe(1);
    expect(minUsers(undefined)).toBe(1);
    expect(minUsers("")).toBe(1);
  });

  it("reads a whole number of at least 1", () => {
    expect(minUsers(" 3 ")).toBe(3);
    expect(minUsers("2")).toBe(2);
  });

  it.each(["0", "-1", "2.5", "two"])("falls back to the default for %s", (value) => {
    expect(minUsers(value)).toBe(1);
  });
});

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
  it("reaches Maintained for a suitable component with enough declared users and a valid SLA", () => {
    expect(computeMaintained(input())).toEqual({ maintained: true, reasons: [], sla: validSla });
  });

  it("is not Maintained when the component is not suitable", () => {
    const level = computeMaintained(input({ endorsement: { passed: false, reasons: ["Overall rating below 2.5"] } }));
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual(["Not yet suitable for Common Ground"]);
  });

  it("reaches Maintained for a stable component, whatever the case of the value", () => {
    expect(computeMaintained(input({ developmentStatus: "Stable" })).maintained).toBe(true);
  });

  it.each(["beta", "development", "concept", "obsolete"])("does not reach Maintained for a %s component", (status) => {
    const level = computeMaintained(input({ developmentStatus: status }));
    expect(level.maintained).toBe(false);
    expect(level.reasons).toEqual([`development status is ${status}, only a stable component can be Maintained`]);
  });

  it("does not reach Maintained when publiccode.yml declares no development status", () => {
    expect(computeMaintained(input({ developmentStatus: null })).reasons).toEqual([
      "development status is not declared, only a stable component can be Maintained",
    ]);
  });

  it("names the users declared in publiccode.yml against the minimum", () => {
    expect(computeMaintained(input({ declaredUserCount: 1 })).reasons).toEqual(["1 of 2 users declared in publiccode.yml"]);
    expect(computeMaintained(input({ declaredUserCount: 2, minUsers: 3 })).reasons).toEqual([
      "2 of 3 users declared in publiccode.yml",
    ]);
  });

  it("reaches Maintained with more declared users than the minimum", () => {
    expect(computeMaintained(input({ declaredUserCount: 5 })).maintained).toBe(true);
  });

  it("says when the users were not counted", () => {
    expect(computeMaintained(input({ declaredUserCount: null })).reasons).toEqual([
      "Users not counted yet: the latest scan did not record usedBy",
    ]);
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

  it("lists every missing condition in order", () => {
    const level = computeMaintained(
      input({ endorsement: { passed: false, reasons: [] }, developmentStatus: "beta", declaredUserCount: 0, slas: [] })
    );
    expect(level.reasons).toEqual([
      "Not yet suitable for Common Ground",
      "development status is beta, only a stable component can be Maintained",
      "0 of 2 users declared in publiccode.yml",
      "No SLA",
    ]);
  });
});
