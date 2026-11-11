import { describe, expect, it, vi } from "vitest";
import * as github from "@/lib/github";
import { checkOwaspSecureCoding } from "@/lib/checkers/owaspSecureCoding";

describe("OWASP secure coding checker", () => {
  it("passes when no risky patterns are found", async () => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(
      "export function safeAdd(a, b) { return a + b; }"
    );

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("No obvious OWASP-style risky coding patterns");
  });

  it("warns when a risky pattern is detected", async () => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(
      "const hash = crypto.createHash('md5');"
    );

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("warn");
    expect(result.evidence?.[0]).toContain("Weak hash algorithm");
  });

  it("reports info, not warn, when no file contents could be read", async () => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce("");

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("info");
  });
});
