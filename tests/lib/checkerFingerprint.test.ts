import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkerFingerprint, computeCheckerFingerprint, pinnedTools } from "@/lib/checkerFingerprint";

const DOCKERFILE = `RUN pip3 install --no-cache-dir --break-system-packages lizard==1.24.3 \\
  && npm install --silent --prefix /opt/analysis-tools/jscpd-4.0.5 jscpd@4.0.5 @scope/tool@1.2.0
`;

let root: string | undefined;

function checkerRoot(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cgchecker-fingerprint-"));
  root = dir;
  for (const [file, content] of Object.entries({ "package.json": '{"version":"0.0.2"}', ...files })) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

describe("checker fingerprint", () => {
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it("lists the pinned tools of the Dockerfile", () => {
    expect(pinnedTools(DOCKERFILE)).toEqual(["@scope/tool@1.2.0", "jscpd@4.0.5", "lizard==1.24.3"]);
  });

  it("changes with a tool version and with the checker's code, and not without", () => {
    const base = computeCheckerFingerprint(checkerRoot({ Dockerfile: DOCKERFILE, "src/lib/a.ts": "export const a = 1;" }));
    rmSync(root!, { recursive: true, force: true });
    const same = computeCheckerFingerprint(checkerRoot({ Dockerfile: DOCKERFILE, "src/lib/a.ts": "export const a = 1;" }));
    rmSync(root!, { recursive: true, force: true });
    const newTool = computeCheckerFingerprint(
      checkerRoot({ Dockerfile: DOCKERFILE.replace("1.24.3", "1.24.4"), "src/lib/a.ts": "export const a = 1;" })
    );
    rmSync(root!, { recursive: true, force: true });
    const newCode = computeCheckerFingerprint(checkerRoot({ Dockerfile: DOCKERFILE, "src/lib/a.ts": "export const a = 2;" }));
    rmSync(root!, { recursive: true, force: true });
    const pageOnly = computeCheckerFingerprint(
      checkerRoot({ Dockerfile: DOCKERFILE, "src/lib/a.ts": "export const a = 1;", "src/app/page.tsx": "x" })
    );

    expect(base.fingerprint).toMatch(/^sha256:[0-9a-f]{32}$/);
    expect(base).toMatchObject({ checkerVersion: "0.0.2", tools: ["@scope/tool@1.2.0", "jscpd@4.0.5", "lizard==1.24.3"] });
    expect(same.fingerprint).toBe(base.fingerprint);
    expect(newTool.fingerprint).not.toBe(base.fingerprint);
    expect(newCode.fingerprint).not.toBe(base.fingerprint);
    expect(pageOnly.fingerprint).toBe(base.fingerprint);
  });

  it("reads the build-time file when there is one", () => {
    const written = { fingerprint: "sha256:built", checkerVersion: "0.0.2", tools: [] };
    expect(checkerFingerprint(checkerRoot({ "checker-fingerprint.json": JSON.stringify(written) }))).toEqual(written);
  });
});
