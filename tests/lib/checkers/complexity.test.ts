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

import { checkComplexity, EXCLUDED_DIRECTORIES, lizardExcludeArgs } from "@/lib/checkers/complexity";

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

    expect(args).toHaveLength((EXCLUDED_DIRECTORIES.length + 1) * 2);
    expect(args.filter((_, index) => index % 2 === 0).every((arg) => arg === "-x")).toBe(true);
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
