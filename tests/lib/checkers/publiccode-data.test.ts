import { describe, expect, it, vi } from "vitest";
import yaml from "js-yaml";
import { analysePublicCode, readPublicCodeData } from "@/lib/checkers/publiccode";
import { GitHubRepositoryProvider } from "@/lib/providers/github";
import type { RepoContext } from "@/lib/providers/types";

const FULL = `
publiccodeYmlVersion: "0.5"
name: OpenRegister
applicationSuite: Conduction
url: "https://github.com/ConductionNL/openregister"
landingURL: "https://openregister.app"
isBasedOn: "https://github.com/nextcloud/server"
softwareVersion: 2.1.46
releaseDate: 2026-11-06
logo: img/app-store.svg
platforms: [web]
categories: [data-collection, document-management]
usedBy: [Gemeente Rotterdam]
roadmap: "https://github.com/ConductionNL/openregister/milestones"
developmentStatus: stable
softwareType: standalone/web
organisation:
  uri: "https://conduction.nl"
  name: Conduction B.V.
fundedBy:
  - name: OpenWoo.app
intendedAudience:
  countries: [nl]
  scope: [government]
description:
  en:
    localisedName: Open Register
    shortDescription: Registers for Nextcloud
    longDescription: |
      Stores objects against schemas.
      Available in the Nextcloud App Store.
    documentation: "https://openregister.app/docs"
    features: [Schemas, Federation]
    screenshots: [img/screenshot-dashboard.png, "javascript:alert(1)"]
    videos: ["https://youtu.be/example"]
  nl:
    shortDescription: Registers voor Nextcloud
legal:
  license: EUPL-1.2
  mainCopyrightOwner: Conduction B.V.
maintenance:
  type: contract
  contractors:
    - name: Conduction B.V.
      until: 2027-12-31
      email: info@conduction.nl
      website: "https://conduction.nl"
  contacts:
    - name: Ruben van der Linde
      affiliation: Conduction B.V.
localisation:
  localisationReady: true
  availableLanguages: [nl, en]
dependsOn:
  open:
    - name: Nextcloud
      versionMin: 30
      versionMax: "33"
    - name: OpenRegister
      optional: true
`;

const context: RepoContext = {
  owner: "ConductionNL",
  repo: "openregister",
  projectPath: "ConductionNL/openregister",
  repoUrl: "https://github.com/ConductionNL/openregister",
  defaultBranch: "main",
  provider: { ...GitHubRepositoryProvider, getFileContent: vi.fn().mockResolvedValue(FULL) },
};

const RAW = "https://raw.githubusercontent.com/ConductionNL/openregister/main";

describe("readPublicCodeData", () => {
  const resolve = (value: unknown) =>
    typeof value === "string" && !value.includes(":") ? `${RAW}/${value}` : null;

  it("reads every field of publiccode.yml", () => {
    const data = readPublicCodeData(yaml.load(FULL), resolve);

    expect(data).toMatchObject({
      publiccodeYmlVersion: "0.5",
      name: "OpenRegister",
      applicationSuite: "Conduction",
      landingURL: "https://openregister.app",
      isBasedOn: ["https://github.com/nextcloud/server"],
      softwareVersion: "2.1.46",
      releaseDate: "2026-11-06",
      logo: `${RAW}/img/app-store.svg`,
      platforms: ["web"],
      categories: ["data-collection", "document-management"],
      usedBy: ["Gemeente Rotterdam"],
      developmentStatus: "stable",
      softwareType: "standalone/web",
      organisation: { name: "Conduction B.V.", uri: "https://conduction.nl" },
      fundedBy: [{ name: "OpenWoo.app", uri: null }],
      intendedAudience: { countries: ["nl"], unsupportedCountries: [], scope: ["government"] },
      legal: { license: "EUPL-1.2", mainCopyrightOwner: "Conduction B.V.", repoOwner: null, authorsFile: null },
      maintenance: {
        type: "contract",
        contractors: [
          { name: "Conduction B.V.", until: "2027-12-31", email: "info@conduction.nl", website: "https://conduction.nl" },
        ],
        contacts: [{ name: "Ruben van der Linde", affiliation: "Conduction B.V.", email: null, phone: null }],
      },
      localisation: { localisationReady: true, availableLanguages: ["nl", "en"] },
      dependsOn: {
        open: [
          { name: "Nextcloud", versionMin: "30", versionMax: "33", version: null, optional: null },
          { name: "OpenRegister", versionMin: null, versionMax: null, version: null, optional: true },
        ],
        proprietary: [],
        hardware: [],
      },
    });
    expect(data?.descriptions).toEqual([
      {
        language: "en",
        localisedName: "Open Register",
        genericName: null,
        shortDescription: "Registers for Nextcloud",
        longDescription: "Stores objects against schemas.\nAvailable in the Nextcloud App Store.",
        documentation: "https://openregister.app/docs",
        apiDocumentation: null,
        features: ["Schemas", "Federation"],
        screenshots: [`${RAW}/img/screenshot-dashboard.png`],
        videos: ["https://youtu.be/example"],
        awards: [],
      },
      expect.objectContaining({ language: "nl", shortDescription: "Registers voor Nextcloud", features: [] }),
    ]);
  });

  it("reads a stored copy back unchanged", () => {
    const data = readPublicCodeData(yaml.load(FULL), resolve);

    expect(readPublicCodeData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("drops a logo that is not an http(s) URL when nothing resolves paths", () => {
    expect(readPublicCodeData({ logo: "javascript:alert(1)" })?.logo).toBeNull();
    expect(readPublicCodeData({ logo: "img/app.svg" })?.logo).toBeNull();
  });

  it("returns null for anything that is not a mapping", () => {
    expect(readPublicCodeData(null)).toBeNull();
    expect(readPublicCodeData(["name"])).toBeNull();
    expect(readPublicCodeData("name: x")).toBeNull();
  });

  it("leaves out fields the file does not declare", () => {
    const data = readPublicCodeData({ name: "Minimal" });

    expect(data).toMatchObject({
      name: "Minimal",
      logo: null,
      platforms: [],
      descriptions: [],
      organisation: null,
      maintenance: { type: null, contractors: [], contacts: [] },
    });
  });
});

describe("analysePublicCode", () => {
  it("stores the publiccode.yml fields with the result, with paths as raw URLs", async () => {
    const { result } = await analysePublicCode(context, ["publiccode.yml"]);

    expect(result.publiccode?.logo).toBe(`${RAW}/img/app-store.svg`);
    expect(result.publiccode?.descriptions[0].screenshots).toEqual([`${RAW}/img/screenshot-dashboard.png`]);
    expect(result.publiccode?.maintenance.contractors[0].until).toBe("2027-12-31");
  });

  it("stores nothing when there is no publiccode.yml", async () => {
    const { result } = await analysePublicCode(context, ["README.md"]);

    expect(result.publiccode).toBeUndefined();
  });
});
