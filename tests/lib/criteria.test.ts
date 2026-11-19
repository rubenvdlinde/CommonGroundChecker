import { describe, expect, it } from "vitest";
import {
  CHECKLIST_CHANGE_PROPOSAL_URL,
  CHECKLIST_VERSION,
  CRITERION_VERSIONS,
  RESULT_CATEGORY_BY_ID,
  RESULT_ORDER_BY_ID,
  checklistVersionLabel,
  isInTransition,
  isMandatoryFromDate,
  transitionNotice,
  upcomingMandatoryFrom,
  withTransition,
  type CriterionVersions,
} from "@/lib/criteria";
import type { CheckResult, RequirementLevel } from "@/lib/types";

const VERSIONS: CriterionVersions = {
  license: { introducedIn: "2026.1", mandatoryFrom: "2027-03-01" },
  publiccode: { introducedIn: "2026.1" },
};

const BEFORE = new Date("2027-02-28T23:59:59Z");
const ON_THE_DATE = new Date("2027-03-01T00:00:00Z");
const AFTER = new Date("2027-06-01T12:00:00Z");

function result(id: string, requirementLevel: RequirementLevel, status: CheckResult["status"] = "fail"): CheckResult {
  return { id, title: id, description: id, requirementLevel, status, message: id };
}

describe("the checklist version", () => {
  it("is a short version label", () => {
    expect(CHECKLIST_VERSION).toMatch(/^\d{4}\.\d+$/);
  });

  it("records the version every criterion was introduced in, and nothing else", () => {
    expect(Object.keys(CRITERION_VERSIONS).sort()).toEqual([...RESULT_ORDER_BY_ID].sort());
    expect(Object.keys(CRITERION_VERSIONS).sort()).toEqual(Object.keys(RESULT_CATEGORY_BY_ID).sort());
    for (const version of Object.values(CRITERION_VERSIONS)) {
      expect(version.introducedIn).toMatch(/^\d{4}\.\d+$/);
      if (version.mandatoryFrom !== undefined) expect(isMandatoryFromDate(version.mandatoryFrom)).toBe(true);
    }
  });

  it("links the change proposal form in the frontend repository", () => {
    expect(CHECKLIST_CHANGE_PROPOSAL_URL).toBe(
      "https://github.com/Hugo-ter-Doest/CommonGroundChecker/issues/new?template=checklist-change.yml"
    );
  });

  it("labels the version an analysis was measured against, or says it is unknown", () => {
    expect(checklistVersionLabel("2026.1")).toBe("Measured against checklist version 2026.1");
    expect(checklistVersionLabel(null)).toBe("Measured against checklist version unknown");
    expect(checklistVersionLabel(undefined)).toBe("Measured against checklist version unknown");
  });
});

describe("upcomingMandatoryFrom", () => {
  it("gives the date before it, for a mandatory criterion", () => {
    expect(upcomingMandatoryFrom(result("license", "mandatory"), BEFORE, VERSIONS)).toBe("2027-03-01");
  });

  it("is null from the start of the date on, so the criterion counts normally", () => {
    expect(upcomingMandatoryFrom(result("license", "mandatory"), ON_THE_DATE, VERSIONS)).toBeNull();
    expect(upcomingMandatoryFrom(result("license", "mandatory"), AFTER, VERSIONS)).toBeNull();
  });

  it("is null for a criterion that is not mandatory, has no date or is unknown", () => {
    expect(upcomingMandatoryFrom(result("license", "recommended"), BEFORE, VERSIONS)).toBeNull();
    expect(upcomingMandatoryFrom(result("publiccode", "mandatory"), BEFORE, VERSIONS)).toBeNull();
    expect(upcomingMandatoryFrom(result("unknown", "mandatory"), BEFORE, VERSIONS)).toBeNull();
  });

  it("ignores a date that is not a valid YYYY-MM-DD date", () => {
    const versions: CriterionVersions = { license: { introducedIn: "2026.1", mandatoryFrom: "2027-02-30" } };
    expect(upcomingMandatoryFrom(result("license", "mandatory"), BEFORE, versions)).toBeNull();
  });
});

describe("withTransition and isInTransition", () => {
  it("marks a mandatory criterion before its date, and leaves it alone after", () => {
    const before = withTransition(result("license", "mandatory"), BEFORE, VERSIONS);
    const after = withTransition(result("license", "mandatory"), AFTER, VERSIONS);

    expect(before.mandatoryFrom).toBe("2027-03-01");
    expect(isInTransition(before)).toBe(true);
    expect(after).not.toHaveProperty("mandatoryFrom");
    expect(isInTransition(after)).toBe(false);
  });

  it("is not in transition without a valid date or when not mandatory", () => {
    expect(isInTransition({ requirementLevel: "mandatory" })).toBe(false);
    expect(isInTransition({ requirementLevel: "mandatory", mandatoryFrom: "soon" })).toBe(false);
    expect(isInTransition({ requirementLevel: "recommended", mandatoryFrom: "2027-03-01" })).toBe(false);
  });
});

describe("transitionNotice", () => {
  it("says when the criterion becomes mandatory", () => {
    expect(transitionNotice("2027-03-01")).toBe("Becomes mandatory on 1 March 2027");
  });
});
