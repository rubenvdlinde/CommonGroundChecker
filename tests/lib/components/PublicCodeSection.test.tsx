/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import PublicCodeSection from "@/components/PublicCodeSection";
import { readPublicCodeData } from "@/lib/checkers/publiccode";
import type { PublicCodeData } from "@/lib/types";

function data(fields: Record<string, unknown>): PublicCodeData {
  return readPublicCodeData(fields) as PublicCodeData;
}

describe("PublicCodeSection", () => {
  afterEach(() => cleanup());

  it("shows the general fields, with http(s) values as links", () => {
    render(
      <PublicCodeSection
        data={data({
          name: "OpenRegister",
          landingURL: "https://openregister.app",
          roadmap: "javascript:alert(1)",
          softwareVersion: "2.1.46",
          releaseDate: "2026-11-06",
          platforms: ["web"],
          categories: ["data-collection"],
          intendedAudience: { countries: ["nl"], scope: ["government"] },
          legal: { license: "EUPL-1.2", mainCopyrightOwner: "Conduction B.V." },
          maintenance: {
            type: "contract",
            contractors: [{ name: "Conduction B.V.", until: "2027-12-31", email: "info@conduction.nl" }],
          },
          localisation: { localisationReady: true, availableLanguages: ["nl", "en"] },
          dependsOn: { open: [{ name: "Nextcloud", versionMin: "30", versionMax: "33" }] },
          organisation: { name: "Conduction B.V.", uri: "https://conduction.nl" },
          fundedBy: [{ name: "OpenWoo.app" }],
        })}
      />
    );

    const section = screen.getByRole("region", { name: "From publiccode.yml" });
    expect(within(section).getByRole("link", { name: "https://openregister.app" })).toBeTruthy();
    expect(within(section).getByText("javascript:alert(1)").closest("a")).toBeNull();
    expect(within(section).getByText("2.1.46, released 2026-11-06")).toBeTruthy();
    expect(within(section).getByText("Scope: government; Countries: nl")).toBeTruthy();
    expect(within(section).getByText("Licence: EUPL-1.2; Copyright: Conduction B.V.")).toBeTruthy();
    expect(within(section).getByText("Contractor: Conduction B.V., until 2027-12-31, info@conduction.nl")).toBeTruthy();
    expect(within(section).getByText("Ready for translation; Languages: nl, en")).toBeTruthy();
    expect(within(section).getByText("Open: Nextcloud (from 30, up to 33)")).toBeTruthy();
    expect(within(section).getByText("OpenWoo.app")).toBeTruthy();
  });

  it("opens the Dutch description first and shows features and screenshots", () => {
    const { container } = render(
      <PublicCodeSection
        data={data({
          description: {
            en: { shortDescription: "Registers for Nextcloud" },
            nl: {
              shortDescription: "Registers voor Nextcloud",
              features: ["Schema's"],
              screenshots: ["https://example.org/shot.png"],
            },
          },
        })}
      />
    );

    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(2);
    expect(details[0].open).toBe(false);
    expect(details[1].open).toBe(true);
    expect(screen.getByText("Schema's")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Screenshot 1" }).getAttribute("src")).toBe("https://example.org/shot.png");
  });

  it("lets long words and links in a description wrap", () => {
    render(
      <PublicCodeSection
        data={data({
          description: { nl: { longDescription: "Zie https://example.org/a/very/long/path/that/does/not/fit" } },
        })}
      />
    );

    const body = screen.getByText(/very\/long\/path/).parentElement;
    expect(body?.className).toContain("[overflow-wrap:anywhere]");
  });

  it("leaves out fields the file does not declare", () => {
    render(<PublicCodeSection data={data({ name: "Minimal" })} />);

    expect(screen.getByText("Minimal")).toBeTruthy();
    expect(screen.queryByText("Maintenance")).toBeNull();
    expect(screen.queryByText("Depends on")).toBeNull();
  });
});
