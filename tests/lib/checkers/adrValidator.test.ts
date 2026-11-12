import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

const childProcessMocks = vi.hoisted(() => ({ stdout: "[]" }));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const handlers: Record<string, (value: unknown) => void> = {};
    let onStdout: (chunk: string) => void = () => {};
    const child = {
      stdout: { on: (_event: string, cb: (chunk: string) => void) => { onStdout = cb; } },
      stderr: { on: () => {} },
      on: (event: string, cb: (value: unknown) => void) => { handlers[event] = cb; },
    };
    setImmediate(() => {
      onStdout(childProcessMocks.stdout);
      handlers.close?.(0);
    });
    return child;
  }),
}));

import { checkAdrValidator, formatSpectralIssue, spectralCommand } from "@/lib/checkers/adrValidator";

describe("formatSpectralIssue", () => {
  it("formats a Spectral issue with code, severity, path and source", () => {
    const issue = {
      code: "operation-ids",
      message: "Operation IDs must be unique.",
      path: ["paths", "/pets", "get", "operationId"],
      severity: 0,
      source: "openapi.yaml",
    };

    expect(formatSpectralIssue(issue)).toBe(
      "ERROR [operation-ids] Operation IDs must be unique. @ paths./pets.get.operationId (openapi.yaml)"
    );
  });

  it("formats a Spectral issue without code or source", () => {
    const issue = {
      message: "Unsupported type detected.",
      severity: 1,
      path: ["components", "schemas", "Pet"],
    };

    expect(formatSpectralIssue(issue)).toBe(
      "WARNING Unsupported type detected. @ components.schemas.Pet"
    );
  });

  it("formats a Spectral issue without path", () => {
    const issue = {
      code: "info-contact",
      message: "Info object should contain contact information.",
      severity: 3,
    };

    expect(formatSpectralIssue(issue)).toBe(
      "HINT [info-contact] Info object should contain contact information."
    );
  });

  it.each([
    [0, "ERROR"],
    [1, "WARNING"],
    [2, "INFO"],
    [3, "HINT"],
  ])("labels Spectral severity %i as %s", (severity, label) => {
    expect(formatSpectralIssue({ code: "rule", message: "Message.", severity })).toBe(
      `${label} [rule] Message.`
    );
  });
});

describe("spectralCommand", () => {
  const binary = path.join(process.cwd(), "node_modules", ".bin", "spectral");

  it("runs the pinned binary from node_modules when it is installed", () => {
    expect(spectralCommand(["lint", "api.yaml"], "linux", () => true)).toEqual({
      command: binary,
      args: ["lint", "api.yaml"],
    });
  });

  it("falls back to npx when the binary is missing", () => {
    expect(spectralCommand(["lint", "api.yaml"], "linux", () => false)).toEqual({
      command: "npx",
      args: ["--yes", "@stoplight/spectral-cli", "lint", "api.yaml"],
    });
  });

  it("runs the binary through cmd on Windows", () => {
    expect(spectralCommand(["lint"], "win32", () => true)).toEqual({
      command: "cmd",
      args: ["/c", `${binary}.cmd`, "lint"],
    });
  });

  it("finds the installed binary in this repository", () => {
    expect(spectralCommand(["lint"]).command).toBe(binary);
  });
});

describe("checkAdrValidator", () => {
  const lint = (severities: number[]) => {
    childProcessMocks.stdout = JSON.stringify(
      severities.map((severity, index) => ({
        code: `rule-${index}`,
        message: "Finding.",
        severity,
      }))
    );
    return checkAdrValidator("org", "repo", "org/repo", "github", "main", ["openapi.yaml"]);
  };

  beforeEach(() => {
    childProcessMocks.stdout = "[]";
  });

  it("fails when Spectral reports at least one error", async () => {
    const result = await lint([0, 1, 3]);

    expect(result.status).toBe("fail");
    expect(result.message).toContain("1 error(s), 1 warning(s), 0 info, 1 hint(s)");
    expect((result.evidence ?? []).filter((line) => line.includes("[rule-"))).toHaveLength(3);
  });

  it("warns when Spectral reports warnings but no errors", async () => {
    const result = await lint([1, 1, 2]);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("0 error(s), 2 warning(s), 1 info, 0 hint(s)");
  });

  it("passes when Spectral reports only info and hints", async () => {
    const result = await lint([2, 3, 3]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("0 error(s), 0 warning(s), 1 info, 2 hint(s)");
    expect((result.evidence ?? []).filter((line) => line.includes("[rule-"))).toHaveLength(3);
  });

  it("passes when Spectral reports no findings", async () => {
    const result = await lint([]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("No API Design Rules violations found by Spectral.");
  });

  it("counts a finding without a severity as an error", async () => {
    childProcessMocks.stdout = JSON.stringify([{ code: "rule", message: "Finding." }]);
    const result = await checkAdrValidator("org", "repo", "org/repo", "github", "main", ["openapi.yaml"]);

    expect(result.status).toBe("fail");
  });
});
