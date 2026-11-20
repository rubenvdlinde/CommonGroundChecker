import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkDuplication,
  mapOpenDuplicationReport,
  type OpenDuplicationReport,
} from "@/lib/checkers/duplication";
import fixture from "../../fixtures/open-duplication-report.json";

const report = fixture as unknown as OpenDuplicationReport;
const FAKE_JSCPD = path.join(process.cwd(), "tests", "fixtures", "bin", "fake-jscpd");

describe("mapOpenDuplicationReport", () => {
  it("shows a real Open Zaak report as information with the raw percentages", () => {
    const result = mapOpenDuplicationReport(report);

    expect(result.id).toBe("duplication");
    expect(result.status).toBe("info");
    expect(result.starRating).toBeUndefined();
    expect(result.message).toContain("jscpd 5.4.2 duplicated lines: 5.8% overall (javascript 5.4%, python 5.8%)");
    expect(result.openTrack?.duplication).toMatchObject({
      tool: "jscpd 5.4.2",
      percentage: 5.75,
      languages: { javascript: 5.39, python: 5.76 },
    });
    expect(result.evidence).toContain("python: 5.8% (2840 of 49265 lines, 251 clone(s) in 342 file(s))");
  });

  it("says the open-track rating rates the raw figures, not that they wait for calibration", () => {
    const { description } = mapOpenDuplicationReport(report);

    expect(description).toContain('rated by "Maintainability, open track" when that rating is available');
    expect(description).not.toContain("calibrated");
  });

  it("lists the five largest clones", () => {
    const clones = mapOpenDuplicationReport(report).evidence?.filter((line) => line.startsWith("Clone of"));

    expect(clones).toHaveLength(5);
    expect(clones?.[0]).toBe(
      "Clone of 37 lines: src/openzaak/components/zaken/api/viewsets.py:1981-2017 and src/openzaak/components/zaken/api/viewsets.py:2087-2123"
    );
  });

  it("warns and leaves the overall figure out when a language was not measured", () => {
    const result = mapOpenDuplicationReport({
      ...report,
      languages: { ...report.languages, python: { files: 342, notMeasured: "jscpd needed more than 2560 MB" } },
      overall: null,
    });

    expect(result.status).toBe("warn");
    expect(result.openTrack?.duplication?.percentage).toBeNull();
    expect(result.openTrack?.duplication?.languages.python).toBeNull();
    expect(result.evidence).toContain("python: not measured: jscpd needed more than 2560 MB");
  });
});

describe("checkDuplication", () => {
  let repo: string;
  const saved = { ...process.env };

  beforeEach(async () => {
    repo = await mkdtemp(path.join(os.tmpdir(), "duplication-test-"));
    await mkdir(path.join(repo, "src"));
    await writeFile(path.join(repo, "src", "a.py"), "a = 1\n".repeat(10));
    await writeFile(path.join(repo, "src", "b.py"), "b = 2\n".repeat(10));
    await writeFile(path.join(repo, "src", "c.ts"), "export const c = 3;\n");
    execFileSync("git", ["init", "-q"], { cwd: repo });
    execFileSync("git", ["add", "."], { cwd: repo });
    process.env.OPEN_DUPLICATION_JSCPD = FAKE_JSCPD;
  });

  afterEach(async () => {
    process.env = { ...saved };
    await rm(repo, { recursive: true, force: true });
  });

  it("warns without a cloned repository", async () => {
    const result = await checkDuplication(undefined);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("could not be cloned");
  });

  it("runs jscpd once per language and reports clones relative to the repository", async () => {
    const result = await checkDuplication(repo);

    expect(result.status).toBe("info");
    expect(result.openTrack?.duplication?.languages).toEqual({ python: 30, typescript: 0 });
    expect(result.openTrack?.duplication?.percentage).toBe(28.57);
    expect(result.openTrack?.duplication?.largestClones[0]).toMatchObject({
      language: "python",
      file: "src/a.py",
      otherFile: "src/b.py",
      lines: 6,
    });
  });

  it("refuses a jscpd that is not the pinned version", async () => {
    process.env.FAKE_JSCPD_VERSION = "jscpd 5.4.3";

    const result = await checkDuplication(repo);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("jscpd 5.4.2");
    expect(result.evidence?.join(" ")).toContain("not the pinned jscpd 5.4.2");
  });

  it("stops a jscpd run above the memory cap and reports the language as not measured", async () => {
    process.env.OPEN_DUPLICATION_MAX_MEMORY_MB = "50";
    process.env.FAKE_JSCPD_HOLD_MB = "200";

    const result = await checkDuplication(repo);

    expect(result.status).toBe("warn");
    expect(result.openTrack?.duplication?.percentage).toBeNull();
    expect(result.evidence).toContain("python: not measured: jscpd needed more than 50 MB");
  });
});
