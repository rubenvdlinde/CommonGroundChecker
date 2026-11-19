import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectProviders,
  contactHref,
  loadProviders,
  providerSlug,
  readRepositoriesConfig,
  repositoriesFile,
} from "@/lib/serviceProviders";

const FIXTURES = path.resolve(__dirname, "../fixtures/providers");

describe("providerSlug", () => {
  it("lower-cases the name, drops accents and joins the words with hyphens", () => {
    expect(providerSlug("Maykin Media")).toBe("maykin-media");
    expect(providerSlug("  Gemeente Súdwest-Fryslân B.V. ")).toBe("gemeente-sudwest-fryslan-b-v");
    expect(providerSlug("***")).toBe("");
  });
});

describe("collectProviders", () => {
  it("groups the entries of one provider over components, with every service and the earliest date", () => {
    const providers = collectProviders({
      repositories: [
        { url: "https://github.com/org/b", providers: [{ name: "Acme", services: ["hosting"], since: "2024-05-01" }] },
        {
          url: "https://github.com/org/a",
          providers: [{ name: "acme", services: ["training", "maintenance"], url: "https://acme.example", since: "2023-01-01" }],
        },
        { url: "https://github.com/org/c" },
      ],
    });
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      slug: "acme",
      name: "Acme",
      url: "https://acme.example",
      contact: null,
      services: ["maintenance", "hosting", "training"],
      since: "2023-01-01",
    });
    expect(providers[0].components.map((component) => [component.href, component.services])).toEqual([
      ["/components/org/a", ["maintenance", "training"]],
      ["/components/org/b", ["hosting"]],
    ]);
  });

  it("leaves out an entry that is not a repository URL or a provider without a usable name", () => {
    expect(
      collectProviders({
        repositories: [
          { url: "not a url", providers: [{ name: "Acme", services: ["hosting"] }] },
          { url: "https://github.com/org/a", providers: [{ name: "---", services: ["hosting"] }] },
        ],
      })
    ).toEqual([]);
  });
});

describe("readRepositoriesConfig", () => {
  it("keeps the url and the providers and drops what is not a provider", () => {
    expect(
      readRepositoriesConfig({
        repositories: [
          { url: "https://github.com/org/a", providers: [{ name: "Acme", services: ["hosting", "cooking"] }, { services: [] }] },
          { name: "no url" },
        ],
      })
    ).toEqual({
      repositories: [{ url: "https://github.com/org/a", providers: [{ name: "Acme", services: ["hosting"] }] }],
    });
    expect(readRepositoriesConfig(null)).toEqual({ repositories: [] });
  });
});

describe("loadProviders", () => {
  it("reads the providers of the component list", async () => {
    const providers = await loadProviders(path.join(FIXTURES, "repositories.yml"));
    expect(providers.map((provider) => provider.name)).toEqual(["Example Training", "Maykin Media"]);
    const maykin = providers[1];
    expect(maykin.services).toEqual(["maintenance", "support", "hosting"]);
    expect(maykin.since).toBe("2020-06-15");
    expect(maykin.components.map((component) => `${component.owner}/${component.repo}`)).toEqual([
      "open-zaak/open-notificaties",
      "open-zaak/open-zaak",
    ]);
  });

  it("has no providers for a list without them, or without a file", async () => {
    expect(await loadProviders(path.join(FIXTURES, "empty.yml"))).toEqual([]);
    expect(await loadProviders(path.join(FIXTURES, "missing.yml"))).toEqual([]);
  });

  it("reads config/repositories.yml unless CGC_REPOSITORIES_FILE names another file", () => {
    expect(repositoriesFile({})).toBe(path.resolve("config/repositories.yml"));
    expect(repositoriesFile({ CGC_REPOSITORIES_FILE: "/tmp/list.yml" })).toBe("/tmp/list.yml");
  });

  it("reads the seed list in the repository, which names no provider yet", async () => {
    expect(await loadProviders(path.resolve(__dirname, "../../config/repositories.yml"))).toEqual([]);
  });
});

describe("contactHref", () => {
  it("links a web address as is and an e-mail address with mailto", () => {
    expect(contactHref("https://example.org/contact")).toBe("https://example.org/contact");
    expect(contactHref("info@example.org")).toBe("mailto:info@example.org");
    expect(contactHref("call us")).toBeNull();
  });
});
