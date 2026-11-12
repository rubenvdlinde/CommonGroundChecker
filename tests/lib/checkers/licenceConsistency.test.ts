import { describe, expect, it } from "vitest";
import type { RepoContext } from "@/lib/providers/types";
import {
  LICENCE_ALIASES,
  checkLicenceConsistency,
  compareLicences,
  evaluateLicenceDeclarations,
  licenceFromLicenseText,
  normaliseLicence,
  parseAppInfoLicence,
  parseCargoTomlLicence,
  parseComposerJsonLicence,
  parsePackageJsonLicence,
  parsePubliccodeLicence,
  parsePyprojectLicence,
  parseSetupCfgLicence,
  type LicenceDeclaration,
} from "@/lib/checkers/licenceConsistency";

function contextWithFiles(files: Record<string, string>): RepoContext {
  return {
    owner: "org",
    repo: "repo",
    projectPath: "org/repo",
    repoUrl: "https://github.com/org/repo",
    provider: {
      id: "github",
      hostname: "github.com",
      parseRepoUrl: () => null,
      getRepoMeta: async () => ({}),
      getRepoTree: async () => Object.keys(files),
      getFileContent: async (_context, path) => files[path] ?? null,
      getRepoVersion: async () => ({ version: null, evidence: { source: "none", detail: "" } }),
      getCloneUrl: () => "",
      getRawFileUrl: () => "",
    },
  };
}

function declaration(source: string, raw: string): LicenceDeclaration {
  return { source, raw, spdx: normaliseLicence(raw) };
}

describe("normaliseLicence", () => {
  it.each([
    ["EUPL-1.2", "EUPL-1.2"],
    ["eupl-1.2", "EUPL-1.2"],
    ["EUPL v1.2", "EUPL-1.2"],
    ["MIT", "MIT"],
    ["mit", "MIT"],
    ["Apache-2.0", "Apache-2.0"],
    ["Apache 2.0", "Apache-2.0"],
    ["agpl-3.0-or-later", "AGPL-3.0-or-later"],
    ["AGPL-3.0-only", "AGPL-3.0-only"],
    ["GPL-3.0+", "GPL-3.0-or-later"],
    ["MIT OR Apache-2.0", "MIT OR Apache-2.0"],
    ["(mit or apache-2.0)", "MIT OR Apache-2.0"],
  ])("normalises %s to %s", (raw, expected) => {
    expect(normaliseLicence(raw)).toBe(expected);
  });

  it("keeps a bare Nextcloud short id as a family without assuming a version", () => {
    expect(normaliseLicence("agpl")).toBe("AGPL");
    expect(LICENCE_ALIASES.agpl).toBe("AGPL");
  });

  it("returns null for values that are not a licence", () => {
    expect(normaliseLicence("SEE LICENSE IN LICENSE")).toBeNull();
    expect(normaliseLicence("")).toBeNull();
  });
});

describe("compareLicences", () => {
  it("treats case differences as the same licence", () => {
    expect(compareLicences("EUPL-1.2", "eupl-1.2")).toBe("same");
  });

  it("treats -only versus -or-later as a variant", () => {
    expect(compareLicences("AGPL-3.0-only", "AGPL-3.0-or-later")).toBe("variant");
  });

  it("accepts a declaration that leaves out the version or the variant", () => {
    expect(compareLicences("AGPL", "AGPL-3.0-or-later")).toBe("same");
    expect(compareLicences("AGPL-3.0", "AGPL-3.0-or-later")).toBe("same");
  });

  it("treats different licences and versions as different", () => {
    expect(compareLicences("EUPL-1.2", "MIT")).toBe("different");
    expect(compareLicences("EUPL-1.1", "EUPL-1.2")).toBe("different");
    expect(compareLicences("AGPL", "GPL-3.0-only")).toBe("different");
  });

  it("ignores the order of OR operands", () => {
    expect(compareLicences("MIT OR Apache-2.0", "Apache-2.0 OR MIT")).toBe("same");
  });
});

describe("manifest parsers", () => {
  it("reads package.json license as string, object and legacy array", () => {
    expect(parsePackageJsonLicence('{"license":"EUPL-1.2"}')).toBe("EUPL-1.2");
    expect(parsePackageJsonLicence('{"license":{"type":"MIT"}}')).toBe("MIT");
    expect(parsePackageJsonLicence('{"licenses":[{"type":"MIT"},{"type":"Apache-2.0"}]}')).toBe(
      "MIT OR Apache-2.0"
    );
    expect(parsePackageJsonLicence("not json")).toBeNull();
  });

  it("reads composer.json license as string or array", () => {
    expect(parseComposerJsonLicence('{"license":"AGPL-3.0-or-later"}')).toBe("AGPL-3.0-or-later");
    expect(parseComposerJsonLicence('{"license":["MIT","GPL-3.0-only"]}')).toBe("MIT OR GPL-3.0-only");
    expect(parseComposerJsonLicence('{"license":["EUPL-1.2"]}')).toBe("EUPL-1.2");
  });

  it("reads publiccode.yml legal.license", () => {
    expect(parsePubliccodeLicence("publiccodeYmlVersion: '0.4'\nlegal:\n  license: EUPL-1.2\n")).toBe(
      "EUPL-1.2"
    );
    expect(parsePubliccodeLicence("name: x\n")).toBeNull();
  });

  it("reads pyproject.toml [project] license as string or inline table", () => {
    expect(parsePyprojectLicence('[project]\nname = "x"\nlicense = "MIT"\n')).toBe("MIT");
    expect(parsePyprojectLicence('[project]\nlicense = { text = "Apache-2.0" }\n')).toBe("Apache-2.0");
    expect(parsePyprojectLicence('[project]\nlicense = { file = "LICENSE" }\n')).toBeNull();
    expect(parsePyprojectLicence('[tool.black]\nlicense = "MIT"\n')).toBeNull();
    expect(parsePyprojectLicence('[tool.poetry]\nlicense = "EUPL-1.2"\n')).toBe("EUPL-1.2");
  });

  it("reads Cargo.toml [package] license", () => {
    expect(parseCargoTomlLicence('[package]\nname = "x"\nlicense = "MIT OR Apache-2.0"\n')).toBe(
      "MIT OR Apache-2.0"
    );
  });

  it("reads setup.cfg [metadata] license", () => {
    expect(parseSetupCfgLicence("[metadata]\nname = x\nlicense = EUPL-1.2\n")).toBe("EUPL-1.2");
    expect(parseSetupCfgLicence("[options]\nlicense = MIT\n")).toBeNull();
  });

  it("reads every <licence> element of appinfo/info.xml", () => {
    expect(parseAppInfoLicence("<info><licence>EUPL-1.2</licence></info>")).toBe("EUPL-1.2");
    expect(parseAppInfoLicence("<info><licence>agpl</licence><licence>mit</licence></info>")).toBe(
      "agpl OR mit"
    );
    expect(parseAppInfoLicence("<info></info>")).toBeNull();
  });

  it("reuses the LICENSE text detection of the licence check", () => {
    expect(licenceFromLicenseText("EUROPEAN UNION PUBLIC LICENCE v. 1.2\nEUPL © the European Union")).toBe(
      "EUPL-1.2"
    );
    expect(licenceFromLicenseText("MIT License\n\nPermission is hereby granted")).toBe("MIT");
    expect(licenceFromLicenseText("GNU AFFERO GENERAL PUBLIC LICENSE ... GNU General Public License")).toBeNull();
  });
});

describe("evaluateLicenceDeclarations", () => {
  it("passes when at least two declarations agree", () => {
    const result = evaluateLicenceDeclarations([
      declaration("composer.json", "EUPL-1.2"),
      declaration("package.json", "eupl-1.2"),
      declaration("appinfo/info.xml", "EUPL v1.2"),
    ]);
    expect(result.id).toBe("licenceconsistency");
    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual([
      "composer.json: EUPL-1.2",
      "package.json: EUPL-1.2",
      "appinfo/info.xml: EUPL-1.2",
    ]);
  });

  it("warns when only one declaration is found", () => {
    const result = evaluateLicenceDeclarations([declaration("package.json", "MIT")]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("Only one licence declaration");
  });

  it("warns when nothing is declared", () => {
    expect(evaluateLicenceDeclarations([]).status).toBe("warn");
  });

  it("warns when declarations differ only in -only versus -or-later", () => {
    const result = evaluateLicenceDeclarations([
      declaration("composer.json", "AGPL-3.0-or-later"),
      declaration("package.json", "AGPL-3.0-only"),
    ]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("-only versus -or-later");
  });

  it("fails and names the mismatch when declarations name different licences", () => {
    const result = evaluateLicenceDeclarations([
      declaration("composer.json", "EUPL-1.2"),
      declaration("package.json", "MIT"),
      declaration("publiccode.yml", "EUPL-1.2"),
    ]);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("EUPL-1.2 (composer.json, publiccode.yml) versus MIT (package.json)");
  });

  it("does not compare unrecognised values but lists them", () => {
    const result = evaluateLicenceDeclarations([
      declaration("package.json", "SEE LICENSE IN LICENSE"),
      declaration("composer.json", "MIT"),
    ]);
    expect(result.status).toBe("warn");
    expect(result.evidence).toContain("package.json: SEE LICENSE IN LICENSE (not recognised, not compared)");
  });
});

describe("checkLicenceConsistency", () => {
  it("collects declarations from the root files and appinfo/info.xml", async () => {
    const context = contextWithFiles({
      LICENSE: "EUROPEAN UNION PUBLIC LICENCE v. 1.2",
      "composer.json": '{"license":"EUPL-1.2"}',
      "package.json": '{"license":"EUPL-1.2"}',
      "publiccode.yml": "legal:\n  license: EUPL-1.2\n",
      "appinfo/info.xml": "<info><licence>agpl</licence></info>",
      "lib/package.json": '{"license":"MIT"}',
    });
    const result = await checkLicenceConsistency(context, await context.provider.getRepoTree(context, "main"));
    expect(result.status).toBe("fail");
    expect(result.evidence).toEqual([
      "LICENSE: EUPL-1.2",
      "package.json: EUPL-1.2",
      "composer.json: EUPL-1.2",
      "publiccode.yml: EUPL-1.2",
      "appinfo/info.xml: AGPL",
    ]);
    expect(result.message).toContain("versus AGPL (appinfo/info.xml)");
  });
});
