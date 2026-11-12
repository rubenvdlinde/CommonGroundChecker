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

  it.each([
    ["a PHP closure", "$ids = array_map(function ($item) { return $item->id; }, $items);"],
    ["a JavaScript anonymous function", "items.forEach(function (item) { console.log(item); });"],
    ["a method call named Function", "registry.Function(name);"],
  ])("does not flag %s as dynamic code execution", async (_label, code) => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(code);

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("pass");
  });

  it.each([
    ["the Function constructor", 'const run = new Function("return 1");'],
    ["eval", "eval(userInput);"],
    ["a string timer", 'setTimeout("doWork()", 10);'],
  ])("flags %s as dynamic code execution", async (_label, code) => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(code);

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("warn");
    expect(result.evidence?.[0]).toContain("Dynamic code execution");
  });
});
