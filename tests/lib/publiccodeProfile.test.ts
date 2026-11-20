import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import {
  PROFILE_EXAMPLE,
  PROFILE_FIELDS,
  PUBLICCODE_YML_VERSION,
  STANDARD_NOTES,
  standardRows,
} from "@/lib/publiccodeProfile";
import { readPublicCodeData } from "@/lib/checkers/publiccode";
import { judgeMaintenance } from "@/lib/checkers/maintenance";
import { readDeclaredLayers } from "@/lib/checkers/fiveLayer";
import { readSupportsIds, resolveSupportsId } from "@/lib/standards";

const root = path.resolve(__dirname, "../..");
const exampleFile = readFileSync(path.join(root, "docs/examples/publiccode.yml"), "utf8");
const markdown = readFileSync(path.join(root, "docs/publiccode-profile.md"), "utf8");

describe("the profile's example", () => {
  it("is the validated example file", () => {
    expect(PROFILE_EXAMPLE).toBe(exampleFile);
  });

  it("follows the profile's publiccode.yml version and declares only known standards", () => {
    const parsed = yaml.load(PROFILE_EXAMPLE) as Record<string, unknown>;
    expect(parsed.publiccodeYmlVersion).toBe(PUBLICCODE_YML_VERSION);
    const kinds = readSupportsIds(parsed).map((id) => resolveSupportsId(id).kind);
    expect(kinds).toEqual(["layer", "known", "known", "known", "known", "alias"]);
  });

  it("passes the checker's own reading of the maintenance, the layer and the fields", () => {
    const parsed = yaml.load(PROFILE_EXAMPLE);
    expect(judgeMaintenance(parsed, "publiccode.yml", "2026-11-19").status).toBe("pass");
    expect(readDeclaredLayers(parsed)?.layers).toEqual(["service"]);
    const data = readPublicCodeData(parsed);
    expect(data?.developmentStatus).toBe("stable");
    expect(data?.usedBy).toHaveLength(2);
    expect(data?.supports).toHaveLength(6);
    expect(data?.descriptions.map((description) => description.language)).toEqual(["nl", "en"]);
  });
});

describe("docs/publiccode-profile.md", () => {
  it("contains the example, every field and every note of the page", () => {
    expect(markdown).toContain(exampleFile);
    for (const field of PROFILE_FIELDS) {
      expect(markdown).toContain(`### ${field.keys}`);
      expect(markdown).toContain(field.example);
      expect(markdown).toContain(`Read by: ${field.usedBy}`);
      for (const line of field.what) expect(markdown).toContain(`- ${line}`);
    }
    for (const note of STANDARD_NOTES) expect(markdown).toContain(`- ${note}`);
  });

  it("lists every standard of the registry, and the standards whose URI is to agree", () => {
    for (const row of standardRows()) {
      expect(markdown).toContain(row.agreed ? `\`${row.uriTemplate}\` | ${row.versions.join(", ")} |` : row.note);
    }
  });
});

describe("the profile's fields", () => {
  it("use every id once", () => {
    const ids = PROFILE_FIELDS.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("follow the current levels: Suitable needs two users, softwareVersion is compared with the basisset", () => {
    const text = (id: string) => PROFILE_FIELDS.find((field) => field.id === id)?.what.join(" ") ?? "";
    const reader = (id: string) => PROFILE_FIELDS.find((field) => field.id === id)?.usedBy ?? "";
    expect(text("used-by")).toContain("Name at least two");
    expect(reader("used-by")).toContain("Suitable for Common Ground needs at least 2 organisations");
    expect(reader("maintenance")).toContain("Maintenance contract criterion");
    expect(text("software-version")).toContain("code.overheid.nl/CommonGround/vcg-basisset");
    expect(PROFILE_FIELDS.map((field) => field.usedBy).join(" ")).not.toMatch(/Approved/);
  });

  it("say which file names the checker accepts and which to use", () => {
    const file = PROFILE_FIELDS.find((field) => field.id === "file");
    expect(file?.what.join(" ")).toContain("accepts publiccode.yml and publiccode.yaml");
    expect(file?.what.join(" ")).toContain("Use publiccode.yml");
  });
});
