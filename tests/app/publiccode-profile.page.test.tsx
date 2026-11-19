/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import PubliccodeProfilePage from "@/app/docs/publiccode-profile/page";
import RatingGuidePage from "@/app/docs/page";
import { PROFILE_FIELDS, PUBLICCODE_PROFILE_PATH } from "@/lib/publiccodeProfile";

describe("PubliccodeProfilePage", () => {
  afterEach(() => cleanup());

  it("shows every field with its requirement", () => {
    render(<PubliccodeProfilePage />);
    expect(screen.getByRole("heading", { level: 1, name: "The Common Ground profile for publiccode.yml" })).toBeTruthy();
    for (const field of PROFILE_FIELDS) {
      const section = document.getElementById(field.id);
      expect(section, field.id).not.toBeNull();
      expect(within(section!).getByRole("heading", { level: 3, name: field.keys })).toBeTruthy();
    }
    expect(within(document.getElementById("maintenance")!).getByText("Needed for Suitable")).toBeTruthy();
    expect(within(document.getElementById("used-by")!).getByText("Needed for Maintained (proposed), proposed")).toBeTruthy();
  });

  it("lists the known standards with their supports id, and the ones whose URI is to agree", () => {
    render(<PubliccodeProfilePage />);
    const table = screen.getByRole("table");
    const zaken = within(table).getByRole("rowheader", { name: /^Zaken API/ }).closest("tr")!;
    expect(zaken.textContent).toContain("https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-{version}.html");
    expect(zaken.textContent).toContain("1.5.1");
    const brp = within(table).getByRole("rowheader", { name: /^BRP API Personen/ }).closest("tr")!;
    expect(brp.textContent).toContain("URI to agree.");
  });

  it("shows the complete example and how to validate it", () => {
    render(<PubliccodeProfilePage />);
    const example = document.getElementById("example")!.closest("section")!;
    expect(example.querySelector("pre")?.textContent).toContain("A complete publiccode.yml for a fictional Common Ground component.");
    expect(screen.getByText(/publiccodeyml\/libpubliccode:v5.5.1 -no-network/)).toBeTruthy();
  });
});

describe("RatingGuidePage", () => {
  afterEach(() => cleanup());

  it("links to the profile", () => {
    render(<RatingGuidePage />);
    expect(
      screen.getByRole("link", { name: "The Common Ground profile for publiccode.yml" }).getAttribute("href")
    ).toBe(PUBLICCODE_PROFILE_PATH);
  });
});
