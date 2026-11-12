import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkOpenSourceHealth,
  licenceExcludes,
  openSourceHealthArgs,
  mapOpenSourceHealthReport,
  openSourceHealthMeasurements,
  type OpenSourceHealthReport,
} from "@/lib/checkers/openSourceHealth";
import { measurementsForAspect, parseMeasurements } from "@/lib/measurements";
import { ASPECT_MODEL } from "@/lib/aspects";
import { aspectComposition } from "@/lib/componentRating";
import { runPythonScript } from "@/lib/checkers/pythonScript";
import fixture from "../../fixtures/open-source-health-report.json";

const report = fixture as unknown as OpenSourceHealthReport;

describe("mapOpenSourceHealthReport", () => {
  it("fails a real report rated 2 stars and lists every property", () => {
    const result = mapOpenSourceHealthReport(report);

    expect(result.id).toBe("opensourcehealth");
    expect(result.status).toBe("fail");
    expect(result.starRating).toBe(2);
    expect(result.message).toContain("840 production dependencies");
    expect(result.evidence).toContain("Vulnerabilities: ★☆☆☆☆ 1 critical, 9 high, 4 moderate");
    expect(result.evidence).toContain("Licence use: ★☆☆☆☆ 5 critical, 0 high, 16 medium, 0 low risk");
    expect(result.evidence).toContain("Management: ★★★★★ 0 unmanaged of 840 dependencies");
  });

  it("reports each property's stars as an aspect rating", () => {
    expect(mapOpenSourceHealthReport(report).aspectRatings).toEqual({
      vulnerabilities: 1,
      freshness: 3,
      activity: 2,
      licence: 1,
      management: 5,
    });
  });

  it("lists the severely vulnerable dependencies", () => {
    const vulnerable = mapOpenSourceHealthReport(report).evidence?.filter((line) => line.startsWith("Vulnerable:"));

    expect(vulnerable?.length).toBeGreaterThan(0);
    expect(vulnerable?.every((line) => /\((high|critical)\)$/.test(line))).toBe(true);
  });

  it.each([
    [5, "pass"],
    [4, "pass"],
    [3, "warn"],
    [1, "fail"],
  ] as const)("maps an overall of %s stars to %s", (stars, status) => {
    expect(mapOpenSourceHealthReport({ ...report, overall: stars }).status).toBe(status);
  });

  it("says when a property could not be rated", () => {
    const unrated = {
      ...report,
      properties: { ...report.properties, vulnerabilities: { stars: null, detail: null, affected: null } },
    };

    expect(mapOpenSourceHealthReport(unrated).evidence).toContain("Vulnerabilities: not rated (data unavailable)");
  });

  it("warns when nothing could be rated", () => {
    const result = mapOpenSourceHealthReport({ ...report, overall: null });

    expect(result.status).toBe("warn");
    expect(result.starRating).toBeUndefined();
  });
});

describe("openSourceHealthMeasurements", () => {
  const groups = openSourceHealthMeasurements(report);
  const group = (id: string) => groups.find((candidate) => candidate.id === id)!;

  it("gives one group per property, keyed by its aspect", () => {
    expect(groups.map(({ id, aspects }) => [id, aspects])).toEqual([
      ["vulnerabilities", ["vulnerabilities"]],
      ["freshness", ["freshness"]],
      ["activity", ["activity"]],
      ["licence", ["licence"]],
      ["management", ["management"]],
    ]);
    expect(mapOpenSourceHealthReport(report).measurements).toEqual(groups);
  });

  it("shows the freshness shares per bound against the thresholds of each level", () => {
    const rows = group("freshness").rows;

    expect(rows.map((row) => row.label)).toEqual([
      "> 1 year",
      "> 2 years",
      "> 3.5 years",
      "> 5 years, absolute bound",
    ]);
    expect(rows[0]).toEqual({
      label: "> 1 year",
      value: "24.5%",
      thresholds: { 5: "≤ 17.1%", 4: "≤ 34.2%", 3: "≤ 68.4%", 2: "any" },
      stars: 4,
    });
    expect(rows[2].stars).toBe(3);
    expect(rows[3]).toEqual({
      label: "> 5 years, absolute bound",
      value: "75 dependencies",
      thresholds: { 5: "none", 4: "none", 3: "any", 2: "any" },
      stars: null,
      starsText: "caps at 3 stars",
    });
  });

  it("uses the activity bounds of the report", () => {
    const rows = group("activity").rows;

    expect(rows.map((row) => row.label)).toEqual([
      "> 1 year",
      "> 2 years",
      "> 4 years",
      "> 5.5 years, absolute bound",
    ]);
    expect(rows[2]).toMatchObject({ value: "21.7%", stars: 2 });
  });

  it("counts vulnerabilities per severity against what each level allows", () => {
    const rows = group("vulnerabilities").rows;

    expect(rows[0]).toEqual({
      label: "Critical or high",
      value: "10",
      thresholds: { 5: "none", 4: "none", 3: "≤ 2", 2: "≤ 5" },
      stars: 1,
    });
    expect(rows[1]).toMatchObject({ label: "Moderate", value: "4", stars: 4 });
    expect(rows[2]).toMatchObject({ label: "Low", value: "3", stars: null, starsText: "not rated" });
  });

  it("counts licences per risk class against what each level allows", () => {
    const rows = group("licence").rows;

    expect(rows.map(({ label, value, stars }) => [label, value, stars])).toEqual([
      ["Critical risk", "5", 1],
      ["High risk", "0", 5],
      ["Medium risk", "16", 3],
      ["Low risk", "0", 5],
    ]);
    expect(rows[3].thresholds).toEqual({ 5: "none", 4: "≤ 3", 3: "any", 2: "any" });
  });

  it("shows the unmanaged share", () => {
    expect(group("management").rows).toEqual([
      {
        label: "Unmanaged third-party code",
        value: "0.0%",
        thresholds: { 5: "none", 4: "≤ 6.0%", 3: "≤ 12.0%", 2: "≤ 24.0%" },
        stars: 5,
      },
    ]);
  });

  it("survives storing and reading back, and is found per aspect", () => {
    const stored = parseMeasurements(JSON.parse(JSON.stringify(groups)));

    expect(stored).toEqual(groups);
    expect(measurementsForAspect(stored, "freshness").map((found) => found.id)).toEqual(["freshness"]);
  });

  it("feeds the threshold table of every Open Source Health aspect in Security", () => {
    const result = mapOpenSourceHealthReport(report);
    const security = ASPECT_MODEL.find((entry) => entry.category === "Security")!;
    const healthAspects = security.aspects.filter(
      (aspect) => aspect.source.type === "check-aspect" && aspect.source.checkId === "opensourcehealth"
    );

    expect(healthAspects).toHaveLength(5);
    for (const aspect of healthAspects) {
      const composition = aspectComposition(aspect, [result]);
      expect(composition.type).toBe("measurements");
    }
  });

  it("gives no measurements for a report without bands or for an unrated property", () => {
    expect(openSourceHealthMeasurements({ ...report, bands: undefined })).toEqual([]);
    const unrated = {
      ...report,
      properties: { ...report.properties, vulnerabilities: { stars: null, detail: null, affected: null } },
    };
    expect(openSourceHealthMeasurements(unrated).map((found) => found.id)).not.toContain("vulnerabilities");
  });
});

describe("checkOpenSourceHealth", () => {
  it("warns without a cloned repository", async () => {
    expect((await checkOpenSourceHealth(undefined)).status).toBe("warn");
  });
});

const SCRIPT = path.join(process.cwd(), "scripts", "open-source-health", "check_open_source_health.py");
const NEXTCLOUD_EXCLUDES = ["^@nextcloud[:/]vue$", "^@nextcloud[:/]l10n$"];
const LOCKED = [
  { name: "@nextcloud/vue", version: "8.0.0", license: "AGPL-3.0-or-later" },
  { name: "@nextcloud/l10n", version: "3.0.0", license: "GPL-3.0-or-later" },
  { name: "agpl-widget", version: "1.0.0", license: "AGPL-3.0-only" },
  { name: "left-pad", version: "1.3.0", license: "MIT" },
];

/** Python's json.dumps(value, sort_keys=True) for plain ASCII data, as the script hashes request bodies. */
function pythonJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pythonJson).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}: ${pythonJson(inner)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

describe("licence excludes from sigrid.yaml", () => {
  let repo: string;

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  /** A repository with LOCKED as its npm lockfile and an OSV cache that knows one high vulnerability in @nextcloud/vue. */
  async function makeRepo(sigrid?: string): Promise<{ cache: string }> {
    repo = await mkdtemp(path.join(os.tmpdir(), "osh-excludes-"));
    const packages: Record<string, unknown> = { "": { name: "app" } };
    for (const dep of LOCKED) packages[`node_modules/${dep.name}`] = { version: dep.version, license: dep.license };
    await writeFile(path.join(repo, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
    if (sigrid !== undefined) await writeFile(path.join(repo, "sigrid.yaml"), sigrid);

    const queries = LOCKED.map((dep) => ({ package: { name: dep.name, ecosystem: "npm" }, version: dep.version }));
    const batchKey = `https://api.osv.dev/v1/querybatch ${createHash("sha256").update(pythonJson({ queries })).digest("hex")}`;
    const results = LOCKED.map((dep) => (dep.name === "@nextcloud/vue" ? { vulns: [{ id: "GHSA-test-0001" }] } : {}));
    const cache = path.join(repo, "cache.json");
    await writeFile(
      cache,
      JSON.stringify({
        [batchKey]: { at: 0, data: { results } },
        "https://api.osv.dev/v1/vulns/GHSA-test-0001": {
          at: 0,
          data: { id: "GHSA-test-0001", severity: null, database_specific: { severity: "HIGH" } },
        },
      })
    );
    return { cache };
  }

  async function scan(cache: string, excludes: string[]): Promise<OpenSourceHealthReport> {
    const jsonPath = path.join(repo, "report.json");
    const args = ["report", repo, "--json", jsonPath, "--offline", "--cache", cache];
    const run = await runPythonScript(SCRIPT, [...args, ...excludes.flatMap((rx) => ["--exclude-licence", rx])], 30000);
    expect(run.stderr).toBe("");
    return JSON.parse(await readFile(jsonPath, "utf8")) as OpenSourceHealthReport;
  }

  it("reads only the license entries of dependencychecker.exclude", async () => {
    await makeRepo(
      [
        "dependencychecker:",
        "  exclude:",
        '    - path: ".*/tests/integration/.*"',
        '    - ".*/scripts/.*"',
        '    - license: "^@nextcloud[:/]vue$"',
        '    - vulnerability: "CVE-2024-12345"',
        '    - license: "^@nextcloud[:/]l10n$"',
      ].join("\n")
    );

    expect(await licenceExcludes(repo)).toEqual(NEXTCLOUD_EXCLUDES);
    expect(await openSourceHealthArgs(repo, "out.json")).toEqual([
      "report", repo, "--json", "out.json",
      "--exclude-licence", NEXTCLOUD_EXCLUDES[0], "--exclude-licence", NEXTCLOUD_EXCLUDES[1],
    ]);
  });

  it("gives no excludes without a sigrid.yaml or with an unreadable one", async () => {
    await makeRepo();
    expect(await licenceExcludes(repo)).toEqual([]);
    await writeFile(path.join(repo, "sigrid.yaml"), "dependencychecker: [unclosed");
    expect(await licenceExcludes(repo)).toEqual([]);
  });

  it("no longer counts an excluded @nextcloud library's licence", async () => {
    const { cache } = await makeRepo();

    const before = (await scan(cache, [])).properties.licence;
    const after = (await scan(cache, NEXTCLOUD_EXCLUDES)).properties.licence;

    expect(before.detail).toMatchObject({ critical: 2, medium: 1, excluded: 0 });
    expect(after.detail).toMatchObject({ critical: 1, medium: 0, excluded: 2 });
  });

  it("still counts an AGPL dependency that is not excluded", async () => {
    const { cache } = await makeRepo();

    const licence = (await scan(cache, NEXTCLOUD_EXCLUDES)).properties.licence;

    expect(licence.detail).toMatchObject({ critical: 1 });
    expect(licence.stars).toBe(1);
  });

  it("rates the licence fully once every risky dependency is excluded", async () => {
    const { cache } = await makeRepo();

    const licence = (await scan(cache, [...NEXTCLOUD_EXCLUDES, "^agpl-widget$"])).properties.licence;

    expect(licence.stars).toBe(5);
  });

  it("still counts the vulnerabilities of an excluded library", async () => {
    const { cache } = await makeRepo();

    const vulnerabilities = (await scan(cache, NEXTCLOUD_EXCLUDES)).properties.vulnerabilities;

    expect(vulnerabilities.affected).toEqual({ "npm:@nextcloud/vue@8.0.0": "high" });
    expect(vulnerabilities.detail).toMatchObject({ high: 1 });
    expect(vulnerabilities.stars).toBe(3);
  });

  it("matches the whole library name, not a part of it", async () => {
    const { cache } = await makeRepo();

    const licence = (await scan(cache, ["@nextcloud"])).properties.licence;

    expect(licence.detail).toMatchObject({ critical: 2, excluded: 0 });
  });

  it("shows the excluded count in the licence evidence", () => {
    const withExcluded = {
      ...report,
      properties: {
        ...report.properties,
        licence: { ...report.properties.licence, detail: { ...report.properties.licence.detail, excluded: 8 } },
      },
    };

    expect(mapOpenSourceHealthReport(withExcluded).evidence).toContain(
      "Licence use: ★☆☆☆☆ 5 critical, 0 high, 16 medium, 0 low risk (8 excluded by sigrid.yaml)"
    );
  });
});
