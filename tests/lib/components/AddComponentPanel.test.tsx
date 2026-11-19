/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import AddComponentPanel, { EXAMPLE_ENTRY } from "@/components/AddComponentPanel";
import { parseYaml } from "@/lib/staticSite/config";
import { checkConfig } from "@/lib/staticSite/validate";

afterEach(cleanup);

describe("AddComponentPanel", () => {
  it("explains the pull request on the component list, with an example and what happens after the merge", () => {
    render(<AddComponentPanel />);
    expect(screen.getByRole("heading", { name: "Add your component" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit the component list" }).getAttribute("href")).toMatch(/\/edit\/main\/config\/repositories\.yml$/);
    expect(screen.getByRole("link", { name: "Request a scan without a pull request" }).getAttribute("href")).toMatch(
      /issues\/new\?template=request-a-scan\.yml$/
    );
    expect(screen.getByText(/next nightly run/)).toBeTruthy();
    expect(screen.getByText(/A provider adds itself with a pull request/)).toBeTruthy();
  });

  it("shows an example entry that passes the schema", () => {
    expect(checkConfig(parseYaml(`repositories:\n${EXAMPLE_ENTRY}\n`), { slas: [] })).toEqual([]);
  });

  it("links to an issue form that exists", () => {
    const form = readFileSync(path.resolve(__dirname, "../../../.github/ISSUE_TEMPLATE/request-a-scan.yml"), "utf-8");
    expect(form).toMatch(/^name: Request a scan/m);
  });

  it("has a one-line form for the Components index", () => {
    render(<AddComponentPanel compact />);
    expect(screen.getByRole("link", { name: "Add it to the component list" }).getAttribute("href")).toBe("/add-component");
  });
});
