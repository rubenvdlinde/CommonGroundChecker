import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SizeMeasurement } from "@/lib/types";
import openRegisterFixture from "../../fixtures/size-openregister.json";

interface Scripted {
  code?: number;
  stdout?: string;
  stderr?: string;
  error?: Error;
}

const processes = vi.hoisted(() => ({ byCommand: {} as Record<string, Scripted>, calls: [] as Array<[string, string[]]> }));

vi.mock("node:child_process", () => ({
  spawn: (command: string, args: string[]) => {
    processes.calls.push([command, args]);
    const script = processes.byCommand[command] ?? { code: 1 };
    const handlers: Record<string, (...values: unknown[]) => void> = {};
    const stream = (name: string) => ({
      on: (event: string, cb: (chunk: string) => void) => {
        if (event === "data") handlers[name] = cb as (...values: unknown[]) => void;
      },
    });
    const child = {
      stdout: stream("stdout"),
      stderr: stream("stderr"),
      kill: () => {},
      on: (event: string, cb: (...values: unknown[]) => void) => {
        handlers[event] = cb;
      },
    };
    setImmediate(() => {
      if (script.error) {
        handlers.error?.(script.error);
        return;
      }
      if (script.stdout) handlers.stdout?.(script.stdout);
      if (script.stderr) handlers.stderr?.(script.stderr);
      handlers.close?.(script.code ?? 0, null);
    });
    return child;
  },
}));

import { checkSize, mapSize } from "@/lib/checkers/size";

const openRegister = openRegisterFixture as SizeMeasurement;

const SCC_OUTPUT = JSON.stringify([
  {
    Name: "PHP",
    Files: [
      { Location: "lib/A.php", Extension: "php", Code: 9000 },
      { Location: "tests/ATest.php", Extension: "php", Code: 7000 },
    ],
  },
  { Name: "Vue", Files: [{ Location: "src/App.vue", Extension: "vue", Code: 307 }] },
]);

describe("mapSize", () => {
  it("reports the lines per language and both effort figures, informative and without stars", () => {
    const result = mapSize(openRegister);

    expect(result).toMatchObject({ id: "size", status: "info", requirementLevel: "informative", size: openRegister });
    expect(result.starRating).toBeUndefined();
    expect(result.message).toBe(
      "555,758 lines of production code in 8,024 file(s), counted with scc 4.1.0. Rebuild effort about 49.7 person-years (open estimate)."
    );
    expect(result.evidence?.[0]).toBe("PHP: 459,995 lines in 7,486 file(s)");
    expect(result.evidence).toContain(
      "Rebuild effort, open estimate: 11,852 function points, 49.7 person-years (proxies: PHP, Vue and TypeScript use the JavaScript factor; CSS uses the HTML factor)"
    );
    expect(result.evidence).toContain(
      "SIG-style volume, context, not part of the 2026 rating: 59.7 person-years (proxies: PHP, Vue, CSS and SQL use the JavaScript factor)"
    );
  });

  it("says not measured when no counted code is in scope", () => {
    const result = mapSize({ tool: "scc 4.1.0", files: 0, loc: 0, languages: [] });

    expect(result.status).toBe("info");
    expect(result.message).toMatch(/^Not measured: no production code/);
    expect(result.size).toBeUndefined();
  });
});

describe("checkSize", () => {
  beforeEach(() => {
    processes.byCommand = {};
    processes.calls = [];
  });

  it("says not measured without a cloned repository", async () => {
    const result = await checkSize(undefined);

    expect(result.message).toBe("Not measured: the repository could not be cloned.");
    expect(processes.calls).toEqual([]);
  });

  it("counts the files of the scope script with scc", async () => {
    processes.byCommand.python3 = { stdout: JSON.stringify(["lib/A.php", "src/App.vue"]) };
    processes.byCommand.scc = { stdout: SCC_OUTPUT };

    const result = await checkSize("/tmp/repo");

    expect(processes.calls.map(([command]) => command)).toEqual(["python3", "scc"]);
    expect(processes.calls[0][1][0]).toMatch(/scripts[\\/]size[\\/]scope\.py$/);
    expect(processes.calls[1][1]).toEqual(expect.arrayContaining(["--by-file", "--no-min-gen", "--no-gitignore"]));
    expect(result.size).toEqual({
      tool: "scc 4.1.0",
      files: 2,
      loc: 9307,
      languages: [
        { language: "PHP", family: "php", files: 1, loc: 9000 },
        { language: "Vue", family: "vue", files: 1, loc: 307 },
      ],
    });
    expect(result.evidence).toContain(
      "SIG-style volume, context, not part of the 2026 rating: 1.0 person-years (proxies: PHP and Vue use the JavaScript factor)"
    );
  });

  it("says not measured when scc is missing", async () => {
    processes.byCommand.python3 = { stdout: "[]" };
    processes.byCommand.scc = { error: new Error("spawn scc ENOENT") };

    const result = await checkSize("/tmp/repo");

    expect(result.message).toBe("Not measured: scc 4.1.0 could not run.");
    expect(result.evidence).toEqual(["spawn scc ENOENT"]);
  });

  it("says not measured when the scope cannot be listed", async () => {
    processes.byCommand.python3 = { code: 1, stderr: "Traceback\nFileNotFoundError: check_maintainability.py" };

    const result = await checkSize("/tmp/repo");

    expect(result.message).toBe("Not measured: the production scope could not be listed.");
    expect(result.evidence).toEqual(["Traceback", "FileNotFoundError: check_maintainability.py"]);
    expect(processes.calls).toHaveLength(1);
  });

  it("says not measured when the scc output is not JSON", async () => {
    processes.byCommand.python3 = { stdout: "[]" };
    processes.byCommand.scc = { stdout: "not json" };

    const result = await checkSize("/tmp/repo");

    expect(result.message).toMatch(/^Not measured: the scc output could not be read/);
  });
});
