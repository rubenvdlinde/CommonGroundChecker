import { beforeEach, describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => ({
  exitCodeFor: (() => 0) as (command: string, args: string[]) => number,
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn((command: string, args: string[]) => {
    const handlers: Record<string, (value: unknown) => void> = {};
    const child = {
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: (event: string, cb: (value: unknown) => void) => { handlers[event] = cb; },
    };
    setImmediate(() => {
      const code = childProcessMocks.exitCodeFor(command, args);
      if (code === 127) {
        handlers.error?.(new Error(`spawn ${command} ENOENT`));
      } else {
        handlers.close?.(code);
      }
    });
    return child;
  }),
}));

import {
  checkComplexity,
  EXCLUDED_DIRECTORIES,
  extractAverageFromFunctionRows,
  lizardExcludeArgs,
  TEST_CODE_PATTERNS,
} from "@/lib/checkers/complexity";

describe("lizardExcludeArgs", () => {
  it("excludes dependency, build and generated output", () => {
    const args = lizardExcludeArgs();

    for (const directory of ["vendor", "node_modules", "dist", "build", "coverage", "generated", ".next", ".git"]) {
      expect(args).toContain(`*/${directory}/*`);
    }
    expect(args).toContain("*.min.js");
  });

  it("passes every pattern as its own -x option", () => {
    const args = lizardExcludeArgs();

    expect(args).toHaveLength((EXCLUDED_DIRECTORIES.length + 1 + TEST_CODE_PATTERNS.length) * 2);
    expect(args.filter((_, index) => index % 2 === 0).every((arg) => arg === "-x")).toBe(true);
  });

  it.each([
    ["repo/tests/Unit/ServiceTest.php", true],
    ["repo/tests/stubs/OCP/IConfig.php", true],
    ["repo/src/components/__tests__/Card.spec.ts", true],
    ["repo/src/lib/stars.test.ts", true],
    ["repo/pkg/client_test.go", true],
    ["repo/app/test_views.py", true],
    ["repo/e2e/login.ts", true],
    ["repo/test-utils/render.ts", true],
    ["repo/lib/Service/TestService.php", false],
    ["repo/lib/Service/ContestService.php", false],
    ["repo/src/latest/index.ts", false],
  ])("treats %s as test code: %s", (path, excluded) => {
    const globs = TEST_CODE_PATTERNS.map((pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`));

    expect(globs.some((glob) => glob.test(`/tmp/checkout/${path}`))).toBe(excluded);
  });
});

describe("checkComplexity", () => {
  beforeEach(() => {
    childProcessMocks.exitCodeFor = () => 0;
  });

  it("reports info, not warn, when lizard is not installed", async () => {
    childProcessMocks.exitCodeFor = () => 127;

    const result = await checkComplexity("owner", "repo", 15, 30);

    expect(result.status).toBe("info");
    expect(result.message).toContain("Lizard is not installed");
  });

  it("reports info, not warn, when the repository cannot be cloned", async () => {
    childProcessMocks.exitCodeFor = (command) => (command === "git" ? 128 : 0);

    const result = await checkComplexity("owner", "repo", 15, 30);

    expect(result.status).toBe("info");
    expect(result.message).toContain("Could not clone repository");
  });

  it("reports info, not warn, when lizard output cannot be parsed", async () => {
    const result = await checkComplexity("owner", "repo", 15, 30, "/tmp/repo");

    expect(result.status).toBe("info");
    expect(result.message).toContain("could not be determined");
  });
});

describe("extractAverageFromFunctionRows", () => {
  it("handles more function rows than fit in a spread argument list", () => {
    const rows = Array.from({ length: 200_000 }, (_, i) => `      10      ${i === 123_456 ? 42 : 2}     50      1      12 f${i}@1-12@a.php`);
    const summary = extractAverageFromFunctionRows(["  NLOC    CCN   token  PARAM  length  location  ", ...rows].join("\n"));

    expect(summary).not.toBeNull();
    expect(summary?.functionCount).toBe(200_000);
    expect(summary?.maxCcn).toBe(42);
    expect(summary?.averageCcn).toBeCloseTo((2 * 199_999 + 42) / 200_000);
  });
});
