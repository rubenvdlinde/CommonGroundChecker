import { describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => ({
  emit: (() => {}) as (
    handlers: Record<string, (value: unknown) => void>,
    onStdout: (chunk: string) => void
  ) => void,
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const handlers: Record<string, (value: unknown) => void> = {};
    let onStdout: (chunk: string) => void = () => {};
    const child = {
      stdout: { on: (_event: string, cb: (chunk: string) => void) => { onStdout = cb; } },
      stderr: { on: () => {} },
      on: (event: string, cb: (value: unknown) => void) => { handlers[event] = cb; },
    };
    setImmediate(() => childProcessMocks.emit(handlers, onStdout));
    return child;
  }),
}));

import { checkAdrValidator, formatSpectralIssue } from "@/lib/checkers/adrValidator";

describe("formatSpectralIssue", () => {
  it("formats a Spectral issue with code, severity, path and source", () => {
    const issue = {
      code: "operation-ids",
      message: "Operation IDs must be unique.",
      path: ["paths", "/pets", "get", "operationId"],
      severity: 1,
      source: "openapi.yaml",
    };

    expect(formatSpectralIssue(issue)).toBe(
      "ERROR [operation-ids] Operation IDs must be unique. @ paths./pets.get.operationId (openapi.yaml)"
    );
  });

  it("formats a Spectral issue without code or source", () => {
    const issue = {
      message: "Unsupported type detected.",
      severity: 2,
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
      severity: 0,
    };

    expect(formatSpectralIssue(issue)).toBe(
      "HINT [info-contact] Info object should contain contact information."
    );
  });
});

describe("checkAdrValidator when Spectral cannot measure", () => {
  const run = () =>
    checkAdrValidator("org", "repo", "org/repo", "github", "main", ["openapi.yaml"]);

  it("reports info, not warn, when Spectral is not available", async () => {
    childProcessMocks.emit = (handlers) => handlers.error?.(new Error("spawn npx ENOENT"));

    const result = await run();

    expect(result.status).toBe("info");
    expect(result.message).toContain("Spectral CLI is not available");
  });

  it("reports info, not warn, when Spectral output cannot be parsed", async () => {
    childProcessMocks.emit = (handlers, onStdout) => {
      onStdout("Error running Spectral: ruleset could not be loaded");
      handlers.close?.(2);
    };

    const result = await run();

    expect(result.status).toBe("info");
    expect(result.message).toContain("could not be fully validated");
  });
});
