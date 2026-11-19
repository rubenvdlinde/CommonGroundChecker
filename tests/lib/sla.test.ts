import { describe, expect, it } from "vitest";
import { DEFAULT_SLA_TERMS, effectiveSlaLabels } from "@/lib/maintenanceTerms";
import {
  addWorkingDays,
  classifyIssue,
  parseSla,
  slaNotMeasured,
  summarizeSla,
  workingDaysBetween,
  type SlaInput,
  type SlaIssue,
} from "@/lib/sla";

const labels = effectiveSlaLabels();

describe("working days", () => {
  it("counts only Monday to Friday on the Amsterdam clock", () => {
    // Friday 13 November 12:00 to Monday 16 November 12:00 (CET, UTC+1)
    expect(workingDaysBetween(new Date("2026-11-13T11:00:00Z"), new Date("2026-11-16T11:00:00Z"))).toBe(1);
    expect(workingDaysBetween(new Date("2026-11-16T11:00:00Z"), new Date("2026-11-16T23:00:00Z"))).toBe(0.5);
    expect(workingDaysBetween(new Date("2026-11-14T10:00:00Z"), new Date("2026-11-15T10:00:00Z"))).toBe(0);
  });

  it("is 0 for an end before the start", () => {
    expect(workingDaysBetween(new Date("2026-11-16T11:00:00Z"), new Date("2026-11-13T11:00:00Z"))).toBe(0);
  });

  it("adds working days over a weekend", () => {
    expect(addWorkingDays(new Date("2026-11-13T11:00:00Z"), 1)).toEqual(new Date("2026-11-16T11:00:00Z"));
    expect(addWorkingDays(new Date("2026-11-13T11:00:00Z"), 5)).toEqual(new Date("2026-11-20T11:00:00Z"));
    // Saturday counts from Monday 00:00 local, 23:00 UTC on Sunday.
    expect(addWorkingDays(new Date("2026-11-14T10:00:00Z"), 1)).toEqual(new Date("2026-11-16T23:00:00Z"));
  });

  it("keeps the local clock across the switch to winter time", () => {
    // Friday 23 October 12:00 CEST (10:00 UTC) plus 1 working day is Monday 26 October 12:00 CET (11:00 UTC).
    expect(addWorkingDays(new Date("2026-10-23T10:00:00Z"), 1)).toEqual(new Date("2026-10-26T11:00:00Z"));
  });
});

describe("classifyIssue", () => {
  it("reads GitHub's default labels and issue types", () => {
    expect(classifyIssue({ labels: ["bug"], issueType: null }, labels)).toEqual({ category: "bug", noFixTerm: false });
    expect(classifyIssue({ labels: ["enhancement"], issueType: null }, labels).category).toBe("feature-request");
    expect(classifyIssue({ labels: [], issueType: "Bug" }, labels).category).toBe("bug");
    expect(classifyIssue({ labels: [], issueType: "Task" }, labels).category).toBe("feature-request");
  });

  it("takes the most severe category and keeps wontfix as no fix term", () => {
    expect(classifyIssue({ labels: ["question", "bug", "blocker"], issueType: null }, labels).category).toBe("blocking-bug");
    expect(classifyIssue({ labels: ["bug", "wontfix"], issueType: null }, labels)).toEqual({ category: "bug", noFixTerm: true });
  });

  it("calls an issue without a known label or type unclassified", () => {
    expect(classifyIssue({ labels: ["needs triage"], issueType: null }, labels).category).toBe("unclassified");
    expect(classifyIssue({ labels: ["Bug"], issueType: null }, labels).category).toBe("bug");
  });
});

function issue(overrides: Partial<SlaIssue>): SlaIssue {
  return {
    title: "An issue",
    url: "https://github.com/org/repo/issues/1",
    createdAt: "2026-11-02T09:00:00Z",
    closedAt: null,
    stateReason: null,
    labels: [],
    issueType: null,
    firstResponseAt: null,
    closingChangeAt: null,
    ...overrides,
  };
}

function input(issues: SlaIssue[], extra: Partial<SlaInput> = {}): SlaInput {
  return { from: "2026-08-21", to: "2026-11-19", issues, releases: [], advisories: [], ...extra };
}

const NOW = new Date("2026-11-19T12:00:00Z");

describe("summarizeSla", () => {
  it("measures the response time and counts a late one", () => {
    const summary = summarizeSla(
      input([
        // Monday 09:00 UTC, answered Tuesday 09:00 UTC: 1 working day.
        issue({ labels: ["bug"], firstResponseAt: "2026-11-03T09:00:00Z" }),
        // Answered after 7 working days, past the 5 day term.
        issue({ labels: ["bug"], firstResponseAt: "2026-11-11T09:00:00Z" }),
      ]),
      DEFAULT_SLA_TERMS,
      labels,
      NOW
    );
    const bug = summary.categories.find((row) => row.category === "bug");
    expect(bug?.count).toBe(2);
    expect(bug?.response).toEqual({ measured: 2, median: 4, worst: 7, breaches: 1, waiting: 0 });
  });

  it("lists an open issue without a response past its due date", () => {
    const summary = summarizeSla(input([issue({ title: "No answer", labels: ["question"] })]), DEFAULT_SLA_TERMS, labels, NOW);
    expect(summary.categories[0].response).toMatchObject({ measured: 0, waiting: 1, breaches: 1 });
    expect(summary.openBreaches).toEqual([
      {
        title: "No answer",
        url: "https://github.com/org/repo/issues/1",
        category: "question",
        kind: "response",
        due: "2026-11-16T09:00:00.000Z",
      },
    ]);
  });

  it("dates a fix by the first stable release after the closing change", () => {
    const summary = summarizeSla(
      input(
        [
          issue({
            labels: ["blocker"],
            firstResponseAt: "2026-11-02T10:00:00Z",
            closedAt: "2026-11-04T09:00:00Z",
            stateReason: "COMPLETED",
            closingChangeAt: "2026-11-04T09:00:00Z",
          }),
        ],
        { releases: ["2026-11-06T09:00:00Z", "2026-11-01T09:00:00Z"] }
      ),
      DEFAULT_SLA_TERMS,
      labels,
      NOW
    );
    const blocking = summary.categories.find((row) => row.category === "blocking-bug");
    expect(blocking?.fix).toEqual({ measured: 1, median: 4, worst: 4, breaches: 0, waiting: 0 });
    expect(summary.fixesByRelease).toBe(1);
    expect(summary.fixesByClose).toBe(0);
  });

  it("dates a fix by closing as completed when no closing change is known", () => {
    const summary = summarizeSla(
      input([issue({ labels: ["blocker"], closedAt: "2026-11-30T09:00:00Z", stateReason: "COMPLETED" })]),
      DEFAULT_SLA_TERMS,
      labels,
      NOW
    );
    expect(summary.categories[0].fix).toMatchObject({ measured: 1, breaches: 1 });
    expect(summary.fixesByClose).toBe(1);
  });

  it("gives a bug until the first release after its response term, and flags a release without the fix", () => {
    const summary = summarizeSla(
      input([issue({ title: "Still broken", labels: ["bug"], firstResponseAt: "2026-11-02T10:00:00Z" })], {
        releases: ["2026-11-12T09:00:00Z"],
      }),
      DEFAULT_SLA_TERMS,
      labels,
      NOW
    );
    expect(summary.categories[0].fix).toMatchObject({ measured: 0, waiting: 1, breaches: 1 });
    expect(summary.openBreaches).toEqual([
      expect.objectContaining({ title: "Still broken", kind: "fix", due: "2026-11-12T09:00:00.000Z" }),
    ]);
  });

  it("has no fix term for questions, feature requests, wontfix or issues closed as not planned", () => {
    const summary = summarizeSla(
      input([
        issue({ labels: ["enhancement"], firstResponseAt: "2026-11-02T10:00:00Z" }),
        issue({ labels: ["bug", "wontfix"], firstResponseAt: "2026-11-02T10:00:00Z" }),
        issue({ labels: ["bug"], closedAt: "2026-11-03T09:00:00Z", stateReason: "NOT_PLANNED", firstResponseAt: "2026-11-02T10:00:00Z" }),
      ]),
      DEFAULT_SLA_TERMS,
      labels,
      NOW
    );
    expect(summary.categories.find((row) => row.category === "feature-request")?.fix).toBeNull();
    expect(summary.categories.find((row) => row.category === "bug")?.fix).toBeNull();
    expect(summary.openBreaches).toEqual([]);
  });

  it("says when no blocking label is used, so every bug counts as an other bug", () => {
    const summary = summarizeSla(input([issue({ labels: ["bug"] })]), DEFAULT_SLA_TERMS, labels, NOW);
    expect(summary.notes).toContain(
      "No issue carries a blocking label (such as blocker or critical), so every bug counts as an other bug."
    );
  });

  it("measures critical and high advisories from draft to publication, without a response time", () => {
    const summary = summarizeSla(
      input([], {
        advisories: [
          {
            title: "RCE",
            url: "https://github.com/org/repo/security/advisories/GHSA-1",
            severity: "critical",
            createdAt: "2026-11-02T09:00:00Z",
            publishedAt: "2026-11-16T09:00:00Z",
          },
          { title: "Low", url: "", severity: "low", createdAt: "2026-11-02T09:00:00Z", publishedAt: "2026-11-03T09:00:00Z" },
        ],
      }),
      DEFAULT_SLA_TERMS,
      labels,
      NOW
    );
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0]).toMatchObject({
      category: "critical-vulnerability",
      count: 1,
      response: null,
      fix: { measured: 1, median: 10, worst: 10, breaches: 1, waiting: 0 },
    });
    expect(summary.notes.some((note) => note.includes("Dependabot alerts need admin rights"))).toBe(true);
  });

  it("says why vulnerabilities were not measured", () => {
    const summary = summarizeSla(input([], { advisories: { notMeasured: "the API refused" } }), DEFAULT_SLA_TERMS, labels, NOW);
    expect(summary.notes).toContain("Vulnerabilities are not measured: the API refused.");
  });
});

describe("parseSla", () => {
  it("reads a stored summary back", () => {
    const summary = summarizeSla(input([issue({ title: "No answer", labels: ["question"] })]), DEFAULT_SLA_TERMS, labels, NOW);
    expect(parseSla(JSON.parse(JSON.stringify(summary)))).toEqual(summary);
    expect(parseSla(slaNotMeasured("no token", NOW))).toMatchObject({ notMeasured: "no token", categories: [] });
  });

  it("leaves out malformed entries and rejects a malformed summary", () => {
    const summary = summarizeSla(input([issue({ labels: ["question"] })]), DEFAULT_SLA_TERMS, labels, NOW);
    const stored = { ...summary, categories: [...summary.categories, { category: 1 }], openBreaches: [{ kind: "other" }] };
    expect(parseSla(stored)?.categories).toHaveLength(1);
    expect(parseSla(stored)?.openBreaches).toEqual([]);
    expect(parseSla({ categories: "x" })).toBeUndefined();
    expect(parseSla(null)).toBeUndefined();
  });
});
