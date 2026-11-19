import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseYaml } from "@/lib/staticSite/config";
import { changedEntries, checkConfig, checkRemote, type RemoteChecks } from "@/lib/staticSite/validate";

const root = path.resolve(__dirname, "../../..");
const noSlas = { slas: [] };

function errors(repositories: unknown, slas: unknown = noSlas) {
  return checkConfig(repositories, slas).filter((finding) => finding.level === "error");
}

describe("checkConfig", () => {
  it("accepts the component list and SLAs in the repository", () => {
    const repositories = parseYaml(readFileSync(path.join(root, "config/repositories.yml"), "utf-8"));
    const slas = parseYaml(readFileSync(path.join(root, "config/slas.yml"), "utf-8"));
    expect(checkConfig(repositories, slas)).toEqual([]);
    expect((repositories as { repositories: unknown[] }).repositories.length).toBeGreaterThan(0);
  });

  it("accepts a full entry", () => {
    expect(
      errors({
        repositories: [
          {
            url: "https://github.com/open-zaak/open-zaak",
            basisset: true,
            scanRef: "latest-release",
            register: true,
            hints: { helm: ["charts/open-zaak"], apiSpecs: ["src/openapi.yaml"] },
            slaLabels: ["sla"],
            providers: [
              { name: "Maykin", services: ["maintenance", "hosting"], url: "https://maykinmedia.nl", contact: "info@maykinmedia.nl", since: "2024-01-01" },
            ],
          },
        ],
      })
    ).toEqual([]);
  });

  it("rejects unknown fields and a missing url", () => {
    const found = errors({ repositories: [{ urll: "https://github.com/a/b" }] });
    expect(found.map((finding) => finding.message).join("\n")).toMatch(/url/);
  });

  it("requires a provider name and at least one known service", () => {
    expect(errors({ repositories: [{ url: "https://github.com/a/b", providers: [{ name: "X", services: [] }] }] })).not.toEqual([]);
    expect(errors({ repositories: [{ url: "https://github.com/a/b", providers: [{ services: ["support"] }] }] })).not.toEqual([]);
    const unknown = errors({ repositories: [{ url: "https://github.com/a/b", providers: [{ name: "X", services: ["consulting"] }] }] });
    expect(unknown[0].message).toMatch(/maintenance, support, hosting, implementation, training/);
  });

  it("rejects a provider listed twice and a since that is not a date", () => {
    const found = errors({
      repositories: [
        {
          url: "https://github.com/a/b",
          providers: [
            { name: "X", services: ["support"], since: "2026-02-30" },
            { name: "x", services: ["hosting"] },
          ],
        },
      ],
    });
    expect(found.map((finding) => finding.message)).toEqual(["2026-02-30 is not a date.", "A provider is listed more than once."]);
  });

  it("rejects duplicates", () => {
    const found = errors({ repositories: [{ url: "https://github.com/a/b" }, { url: "https://github.com/A/b.git" }] });
    expect(found).toEqual([{ level: "error", subject: "https://github.com/a/b", message: "Listed more than once in config/repositories.yml." }]);
  });

  it("rejects an SLA on an unlisted repository and one that ends before it starts", () => {
    const found = errors(
      { repositories: [{ url: "https://github.com/a/b" }] },
      {
        slas: [
          { repository: "https://github.com/a/c", party: "VNG", maintainer: "M", start: "2026-01-01", until: "2026-12-31" },
          { repository: "https://github.com/a/b", party: "VNG", maintainer: "M", start: "2026-06-01", until: "2026-01-01" },
        ],
      }
    );
    expect(found.map((finding) => finding.message)).toEqual([
      "SLA on a repository that is not in config/repositories.yml.",
      "The SLA ends before it starts.",
    ]);
  });
});

describe("changedEntries", () => {
  it("returns only new and changed entries", () => {
    const base = { repositories: [{ url: "https://github.com/a/b" }, { url: "https://github.com/a/c" }] };
    const current = {
      repositories: [{ url: "https://github.com/a/b" }, { url: "https://github.com/a/c", basisset: true }, { url: "https://github.com/a/d" }],
    };
    expect(changedEntries(current, base).map((entry) => entry.url)).toEqual(["https://github.com/a/c", "https://github.com/a/d"]);
    expect(changedEntries(current, null)).toHaveLength(3);
  });
});

describe("checkRemote", () => {
  const remote: RemoteChecks = {
    isPublic: async (url) => !url.endsWith("/private"),
    publiccodeFile: async (url) => (url.endsWith("/with") ? "publiccode.yml" : url.includes("gitea") ? undefined : null),
  };

  it("fails a repository that is not public and warns when publiccode.yml is missing", async () => {
    const findings = await checkRemote(
      [
        { url: "https://github.com/a/with" },
        { url: "https://github.com/a/private" },
        { url: "https://github.com/a/without" },
        { url: "https://gitea.example/a/b" },
        { url: "https://github.com/a/private", retired: { on: "2026-01-01", reason: "archived" } },
      ],
      remote
    );
    expect(findings.map((finding) => [finding.level, finding.subject])).toEqual([
      ["error", "https://github.com/a/private"],
      ["warning", "https://github.com/a/without"],
      ["warning", "https://gitea.example/a/b"],
    ]);
  });
});
