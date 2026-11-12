import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as github from "@/lib/github";
import { checkOwaspSecureCoding, getFailThreshold, isSecretLookAlike, stripCommentLines } from "@/lib/checkers/owaspSecureCoding";

const RISKY = "const hash = crypto.createHash('md5');";
const SAFE = "export const add = (a, b) => a + b;";

async function writeRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "owasp-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
    await writeFile(path.join(root, relativePath), content);
  }
  return root;
}

function sourceFiles(total: number, risky: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: total }, (_, index) => [
      `src/file${index}.ts`,
      index < risky ? RISKY : SAFE,
    ])
  );
}

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

  describe("with a cloned repository", () => {
    const repoRoots: string[] = [];

    afterEach(async () => {
      await Promise.all(repoRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
    });

    async function scan(files: Record<string, string>) {
      const root = await writeRepo(files);
      repoRoots.push(root);
      return checkOwaspSecureCoding("owner", "repo", Object.keys(files), root);
    }

    it("fails a small repository from 4 findings", async () => {
      expect((await scan(sourceFiles(50, 3))).status).toBe("warn");
      expect((await scan(sourceFiles(50, 4))).status).toBe("fail");
    });

    it("scales the fail threshold with the number of scanned files", { timeout: 60000 }, async () => {
      const warned = await scan(sourceFiles(600, 6));
      expect(warned.status).toBe("warn");
      expect(warned.message).toContain("6 findings across 600 scanned source files, failing from 7");

      expect((await scan(sourceFiles(600, 7))).status).toBe("fail");
    });

    it("leaves test code out of the scan", async () => {
      const result = await scan({
        "src/main.ts": SAFE,
        "tests/unit/auth.ts": "const password = 'correct-horse-battery';",
        "test/helpers.js": RISKY,
        "src/__tests__/render.ts": "el.innerHTML = '<b>x</b>';",
        "spec/api.rb": RISKY,
        "src/fixtures/user.ts": "const token = 'abcdefghijkl';",
        "src/login.test.ts": RISKY,
        "src/login.spec.js": RISKY,
        "internal/rotate/rotate_test.go": RISKY,
        "tools/test_cli.py": RISKY,
        "browser-extension/e2e/seed.ts": RISKY,
        "browser-extension/test-site/totp.js": RISKY,
        "android/app/src/androidTest/java/FormActivity.java": RISKY,
        "src/testdata/case.go": RISKY,
      });

      expect(result.status).toBe("pass");
      expect(result.message).toContain("1 scanned source files");
    });

    it("still scans files whose names only contain test words", async () => {
      const result = await scan({
        "src/testing/attestation.ts": RISKY,
        "src/contest.go": RISKY,
        "src/latest_test_results.php": RISKY,
      });

      expect(result.status).toBe("warn");
      expect(result.message).toContain("3 findings across 3 scanned source files");
    });
  });

  it.each([
    [0, 4],
    [20, 4],
    [399, 4],
    [400, 5],
    [1000, 11],
    [14216, 143],
  ])("fails %i scanned files from %i findings", (scannedFileCount, threshold) => {
    expect(getFailThreshold(scannedFileCount)).toBe(threshold);
  });

  it.each([
    ["a PyTorch eval() method", "model.eval()"],
    ["a PHP eval() method", "$result = $parser->eval($expression);"],
    ["a docblock that names eval()", "/**\n * A parser, not eval(), reads these expressions.\n */\nfunction parse() {}"],
    ["a line comment that names eval()", "// never eval() user input\nconst x = 1;"],
    ["a Python comment that names eval()", "# no eval() here\nx = 1"],
  ])("does not flag %s as dynamic code execution", async (_label, code) => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(code);

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("pass");
  });

  it.each([
    ["the name of a setting", "public const CONFIG_SECRET = 'portal_assertion_secret';"],
    ["a key prefix", "private const SECRET = 'example-set-secret:sha256:';"],
    ["a redaction placeholder", "$secret = '[redacted]';"],
    ["a regular expression", "private const TOKEN = '/@([a-z][a-z0-9._-]{0,63})/u';"],
    ["a regular expression with an escaped quote", "private const TOKEN = '/(?<![\\p{L}._@\\'-])@(?:\"([^\"]{1,64})\")/u';"],
    ["a map from format to input type", "const types = { password: 'password' };"],
    ["a bound Vue attribute", '<TokenDisplay :token="createdToken" />'],
  ])("does not flag %s as a hardcoded secret", async (_label, code) => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(code);

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("pass");
  });

  it.each([
    ["a random token", "const token = 'f3Kq9ZpL0aWx7Rt2';"],
    ["a word with digits", "$password = 'password123';"],
    ["a prefixed random secret", "API_KEY = 'secret_9fQxT2bLm8Zr'"],
    ["an object credential", 'const config = { apiKey: "AbCdEf123456GhIj" };'],
  ])("flags %s as a hardcoded secret", async (_label, code) => {
    vi.spyOn(github, "getFileContent").mockResolvedValueOnce(code);

    const result = await checkOwaspSecureCoding("owner", "repo", ["src/main.ts"]);

    expect(result.status).toBe("warn");
    expect(result.evidence?.[0]).toContain("Possible hardcoded secret");
  });

  it("keeps code lines and attribute lines when blanking comments", () => {
    expect(stripCommentLines("#[Route('x')]\n# note\n$a = 1; // eval()\n * doc")).toBe("#[Route('x')]\n\n$a = 1; // eval()\n");
  });

  it("tells look-alikes from values that may be secrets", () => {
    expect(isSecretLookAlike("openregister_case_token")).toBe(true);
    expect(isSecretLookAlike("<your-api-key>")).toBe(true);
    expect(isSecretLookAlike("mysecretpassword")).toBe(false);
    expect(isSecretLookAlike("token_8aF3kQ")).toBe(false);
  });
});
