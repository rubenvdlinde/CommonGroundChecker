import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLocalContext,
  listCheckoutTree,
  parseRemoteUrl,
  resolveInside,
  resolveLocalCheckout,
} from "@/lib/providers/local";

let dir: string;

function git(...args: string[]) {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdio: "ignore" });
}

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), content);
}

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "local-provider-"));
  git("init", "-q", "-b", "development");
  git("remote", "add", "origin", "https://github.com/ConductionNL/example.git");
  write(".gitignore", "vendor/\n");
  write("lib/Service/Thing.php", "<?php\n");
  write("package.json", JSON.stringify({ version: "0.4.2" }));
  write("LICENSE", "EUROPEAN UNION PUBLIC LICENCE v. 1.2\nEUPL (c) the European Union 2007, 2016\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("parseRemoteUrl", () => {
  it("reads https and ssh remotes", () => {
    expect(parseRemoteUrl("https://github.com/ConductionNL/pipelinq.git")).toEqual({ owner: "ConductionNL", repo: "pipelinq", host: "github" });
    expect(parseRemoteUrl("git@github.com:ConductionNL/pipelinq.git")).toEqual({ owner: "ConductionNL", repo: "pipelinq", host: "github" });
    expect(parseRemoteUrl("https://gitlab.com/group/sub/project")).toEqual({ owner: "group/sub", repo: "project", host: "gitlab" });
    expect(parseRemoteUrl("/srv/git/repo")).toBeNull();
  });
});

describe("resolveInside", () => {
  it("refuses paths that leave the checkout", () => {
    expect(resolveInside("/a/b", "c/d.txt")).toBe(path.resolve("/a/b/c/d.txt"));
    expect(resolveInside("/a/b", "../x")).toBeNull();
    expect(resolveInside("/a/b", "/etc/passwd")).toBeNull();
  });
});

describe("listCheckoutTree", () => {
  it("lists tracked and untracked files with their directories, not ignored ones", async () => {
    write("docs/new.md", "# new\n");
    write("vendor/pkg/a.php", "<?php\n");
    const tree = await listCheckoutTree(dir);
    expect(tree).toEqual(expect.arrayContaining(["lib", "lib/Service", "lib/Service/Thing.php", "docs", "docs/new.md", "LICENSE"]));
    expect(tree.some((p) => p.startsWith("vendor"))).toBe(false);
  });

  it("rejects a directory that is not a checkout", async () => {
    const plain = mkdtempSync(path.join(os.tmpdir(), "not-a-checkout-"));
    try {
      await expect(listCheckoutTree(plain)).rejects.toThrow(/not a git checkout/);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe("createLocalContext", () => {
  it("names the checkout after its origin remote", async () => {
    const checkout = await resolveLocalCheckout(dir);
    expect(checkout).toMatchObject({ owner: "ConductionNL", repo: "example", host: "github" });
    const context = createLocalContext(checkout);
    expect(context.repoUrl).toBe("https://github.com/ConductionNL/example");
    expect(context.projectPath).toBe(path.resolve(dir));
  });

  it("reads files in place and nothing outside the checkout", async () => {
    const context = createLocalContext(await resolveLocalCheckout(dir));
    expect(await context.provider.getFileContent(context, "lib/Service/Thing.php")).toBe("<?php\n");
    expect(await context.provider.getFileContent(context, "../outside")).toBeNull();
    expect(await context.provider.getFileContent(context, "missing.txt")).toBeNull();
  });

  it("detects the licence from the LICENSE file and the branch from HEAD", async () => {
    const context = createLocalContext(await resolveLocalCheckout(dir));
    const meta = await context.provider.getRepoMeta(context);
    expect(meta.default_branch).toBe("development");
    expect(String(meta.license?.name)).toMatch(/European Union Public Licen/i);
  });

  it("takes the version from the best reachable tag, else the manifest", async () => {
    const context = createLocalContext(await resolveLocalCheckout(dir));
    expect(await context.provider.getRepoVersion(context)).toMatchObject({ version: "v0.4.2", evidence: { source: "manifest" } });
    git("tag", "v1.2.0");
    git("tag", "v1.10.0");
    git("tag", "v2.0.0-beta.1");
    expect(await context.provider.getRepoVersion(context)).toMatchObject({ version: "v1.10.0", evidence: { source: "tag" } });
  });
});
