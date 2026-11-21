import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

describe("the Retired status", () => {
  it("is gone from the source, the config and its schema", () => {
    const sources = [
      ...files(path.join(root, "src")),
      path.join(root, "config/repositories.yml"),
      path.join(root, "config/schema/repositories.schema.json"),
      path.join(root, "public/openapi.json"),
    ];
    const found = sources.filter((file) => /retire/i.test(readFileSync(file, "utf-8"))).map((file) => path.relative(root, file));
    expect(found).toEqual([]);
  });
});
