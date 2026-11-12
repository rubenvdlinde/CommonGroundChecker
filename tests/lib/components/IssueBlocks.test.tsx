/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import IssueBlocks, { splitIssues } from "@/components/IssueBlocks";
import { criterionAnchorId } from "@/lib/criteria";
import ResultCard from "@/components/ResultCard";
import type { CheckResult, CheckStatus, RequirementLevel } from "@/lib/types";

function result(
  id: string,
  requirementLevel: RequirementLevel | undefined,
  status: CheckStatus,
  extra: Partial<CheckResult> = {}
): CheckResult {
  return {
    id,
    title: `Title ${id}`,
    description: `Description ${id}`,
    requirementLevel,
    status,
    message: `Message ${id}`,
    ...extra,
  };
}

const LEVELS: (RequirementLevel | undefined)[] = ["mandatory", "recommended", "informative", undefined];
const STATUSES: CheckStatus[] = ["pass", "fail", "warn", "info"];

function expectedBlock(level: RequirementLevel | undefined, status: CheckStatus) {
  const effective = level ?? "recommended";
  if (effective === "mandatory" && status === "fail") return "error";
  if (effective === "mandatory" && status === "warn") return "warning";
  if (effective === "recommended" && (status === "fail" || status === "warn")) return "warning";
  return "none";
}

describe("splitIssues", () => {
  for (const level of LEVELS) {
    for (const status of STATUSES) {
      const expected = expectedBlock(level, status);
      it(`puts a ${level ?? "level-less"} result with status ${status} in ${expected}`, () => {
        const { errors, warnings } = splitIssues([result("license", level, status)]);
        expect(errors).toHaveLength(expected === "error" ? 1 : 0);
        expect(warnings).toHaveLength(expected === "warning" ? 1 : 0);
      });
    }
  }

  it("leaves out results without a category, since they have no card", () => {
    const { errors, warnings } = splitIssues([
      result("unknown", "mandatory", "fail"),
      result("other", "recommended", "warn"),
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("attaches the category and orders entries like the result list", () => {
    const { errors, warnings } = splitIssues([
      result("semver", "mandatory", "fail"),
      result("security", "mandatory", "fail"),
      result("publiccode", "mandatory", "warn"),
      result("license", "mandatory", "fail"),
    ]);
    expect(errors.map((entry) => [entry.result.id, entry.category])).toEqual([
      ["license", "Governance"],
      ["security", "Security"],
      ["semver", "Deployment & Operations"],
    ]);
    expect(warnings.map((entry) => entry.result.id)).toEqual(["publiccode"]);
  });
});

describe("IssueBlocks", () => {
  afterEach(() => {
    cleanup();
    window.location.hash = "";
  });

  it("renders both blocks with counts, entries and links to the criterion cards", () => {
    render(
      <IssueBlocks
        results={[
          result("license", "mandatory", "fail", { title: "License file", message: "No LICENSE found" }),
          result("security", "mandatory", "fail"),
          result("publiccode", "mandatory", "warn", { message: "Missing recommended fields" }),
          result("changelog", "recommended", "fail"),
          result("docker", "recommended", "warn"),
          result("sbom", "recommended", "pass"),
          result("coverage", "recommended", "info"),
          result("tests", "informative", "fail"),
        ]}
      />
    );

    const errors = screen.getByRole("region", { name: /2 errors: missing mandatory items/i });
    const warnings = screen.getByRole("region", { name: /3 warnings: missing or incomplete items/i });

    expect(within(errors).getAllByRole("listitem")).toHaveLength(2);
    expect(within(warnings).getAllByRole("listitem")).toHaveLength(3);

    const licenseLink = within(errors).getByRole("link", { name: /License file: go to the License file result/ });
    expect(licenseLink.getAttribute("href")).toBe("#criterion-license");
    expect(within(errors).getByText("No LICENSE found")).toBeTruthy();
    expect(within(errors).getByText("Governance")).toBeTruthy();
    expect(within(warnings).getByText("Missing recommended fields")).toBeTruthy();
    expect(within(warnings).getByText("Deployment & Operations")).toBeTruthy();

    expect(screen.queryByText("Title sbom")).toBeNull();
    expect(screen.queryByText("Title coverage")).toBeNull();
    expect(screen.queryByText("Title tests")).toBeNull();
  });

  it("shows a positive line in a block with no entries", () => {
    render(<IssueBlocks results={[result("license", "mandatory", "pass")]} />);

    const errors = screen.getByRole("region", { name: /0 errors/i });
    const warnings = screen.getByRole("region", { name: /0 warnings/i });
    expect(within(errors).getByText("No missing mandatory items")).toBeTruthy();
    expect(within(warnings).getByText("No missing or incomplete items")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("uses the singular for a count of one", () => {
    render(<IssueBlocks results={[result("license", "mandatory", "fail")]} />);
    expect(screen.getByRole("region", { name: /^1 error: missing mandatory items$/i })).toBeTruthy();
  });

  it("expands and focuses the targeted result card, also when its link is followed again", () => {
    render(
      <>
        <IssueBlocks results={[result("license", "mandatory", "fail", { title: "License file" })]} />
        <ResultCard {...result("license", "mandatory", "fail", { title: "License file", message: "Card detail" })} />
      </>
    );

    const card = document.getElementById(criterionAnchorId("license"));
    expect(card).not.toBeNull();
    const toggle = within(card as HTMLElement).getByRole("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      window.location.hash = "#criterion-license";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("link", { name: /License file/ }));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
