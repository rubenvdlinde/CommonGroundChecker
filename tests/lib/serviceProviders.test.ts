import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  collectProviders,
  contactHref,
  gitlabAvatarUrl,
  isOwner,
  listedServicesByComponent,
  loadRepositoriesConfig,
  ownerOfRepository,
  ownerSlug,
  readRepositoriesConfig,
  repositoriesFile,
} from "@/lib/serviceProviders";
import { ownerHref } from "@/lib/repositoryOwner";

const FIXTURES = path.resolve(__dirname, "../fixtures/providers");

describe("ownerSlug", () => {
  it("keeps a GitHub login in lower case", () => {
    expect(ownerSlug("github.com", "ConductionNL")).toBe("conductionnl");
    expect(ownerSlug("github.com", "open-zaak")).toBe("open-zaak");
  });

  it("puts the host first and turns each group of a nested GitLab path into one part", () => {
    expect(ownerSlug("gitlab.com", "digilab.overheid.nl/ecosystem/ftv")).toBe("gitlab--digilab-overheid-nl--ecosystem--ftv");
    expect(ownerSlug("gitlab.com", "rinis-oss")).toBe("gitlab--rinis-oss");
    expect(ownerSlug("code.example.org", "Team_A/sub")).toBe("code-example-org--team-a--sub");
  });

  it("gives only characters that are safe in a path", () => {
    expect(ownerSlug("gitlab.com", "a b/ç/../x")).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("ownerOfRepository", () => {
  it("names the owner, its host and its page", () => {
    expect(ownerOfRepository("https://gitlab.com/digilab.overheid.nl/ecosystem/ftv/open-ftv.git")).toEqual({
      slug: "gitlab--digilab-overheid-nl--ecosystem--ftv",
      name: "digilab.overheid.nl/ecosystem/ftv",
      host: "gitlab.com",
      hostLabel: "GitLab",
      url: "https://gitlab.com/digilab.overheid.nl/ecosystem/ftv",
    });
    expect(ownerOfRepository("https://github.com/ConductionNL/openregister")?.hostLabel).toBe("GitHub");
    expect(ownerOfRepository("not a url")).toBeNull();
  });

  it("links to the provider page of a repository", () => {
    expect(ownerHref("https://github.com/ConductionNL/openregister")).toBe("/providers/conductionnl");
    expect(ownerHref("https://github.com/only-owner")).toBeNull();
  });
});

describe("isOwner", () => {
  const owner = ownerOfRepository("https://github.com/maykinmedia/open-klant")!;

  it("matches the owner's name ignoring case and spacing, or its page", () => {
    expect(isOwner({ name: "Maykin Media" }, owner)).toBe(true);
    expect(isOwner({ name: "Acme", url: "https://github.com/MaykinMedia/" }, owner)).toBe(true);
    expect(isOwner({ name: "Acme", url: "https://acme.example" }, owner)).toBe(false);
  });

  it("matches the last group of a nested GitLab path", () => {
    expect(isOwner({ name: "FTV" }, ownerOfRepository("https://gitlab.com/digilab/ecosystem/ftv/open-ftv")!)).toBe(true);
  });
});

describe("collectProviders", () => {
  const config = readRepositoriesConfig({
    repositories: [
      { url: "https://github.com/org/b", providers: [{ name: "Org", services: ["hosting", "maintenance"] }, { name: "Acme", services: ["training"] }] },
      { url: "https://github.com/org/a" },
      { url: "https://github.com/solo/one" },
      { url: "https://gitlab.com/group/sub/c" },
    ],
  });

  it("gives every owner one provider, with most components first and then by name", () => {
    const providers = collectProviders(
      [
        { repoUrl: "https://github.com/Org/a", owner: "Org", repo: "a", displayName: "Alpha", analysed: true, rating: 3.2, status: "measured", basisset: true },
        { repoUrl: "https://github.com/org/b", analysed: true, rating: 4.1, status: "suitable", basisset: null },
      ],
      config
    );
    expect(providers.map((provider) => [provider.slug, provider.components.length])).toEqual([
      ["org", 2],
      ["gitlab--group--sub", 1],
      ["solo", 1],
    ]);
    const org = providers[0];
    expect(org).toMatchObject({ name: "Org", hostLabel: "GitHub", avatarUrl: "https://github.com/Org.png?size=96", bestRating: 4.1 });
    expect(org.components.map((component) => [component.name, component.href, component.analysed, component.status])).toEqual([
      ["Alpha", "/components/Org/a", true, "measured"],
      ["org/b", "/components/org/b", true, "suitable"],
    ]);
    expect(org.components[1].services).toEqual(["maintenance", "hosting"]);
    expect(org.services).toEqual(["maintenance", "hosting"]);
    expect(providers[1]).toMatchObject({ name: "group/sub", hostLabel: "GitLab", avatarUrl: null, bestRating: null });
    expect(providers[1].components[0]).toMatchObject({ name: "group/sub/c", analysed: false, rating: null, status: null });
  });

  it("is not empty for a component list without any providers field", () => {
    expect(collectProviders([], readRepositoriesConfig({ repositories: [{ url: "https://github.com/x/y" }] }))).toHaveLength(1);
  });

  it("leaves out an entry that is not a repository URL and lists a repository once", () => {
    const providers = collectProviders(
      [{ repoUrl: "https://github.com/x/y/", analysed: true }],
      { repositories: [{ url: "not a url" }, { url: "https://github.com/X/Y" }] }
    );
    expect(providers).toHaveLength(1);
    expect(providers[0].components).toHaveLength(1);
    expect(providers[0].components[0].analysed).toBe(true);
  });
});

describe("gitlabAvatarUrl", () => {
  const group = ownerOfRepository("https://gitlab.com/digilab.overheid.nl/ecosystem/ftv/open-ftv")!;

  it("reads the public group's avatar without a token", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ avatar_url: "https://gitlab.com/uploads/group/avatar.png" })));
    expect(await gitlabAvatarUrl(group, fetchFn as unknown as typeof fetch)).toBe("https://gitlab.com/uploads/group/avatar.png");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/groups/digilab.overheid.nl%2Fecosystem%2Fftv",
      expect.anything()
    );
  });

  it("has none when the group has none, cannot be read, or is not on GitLab", async () => {
    const empty = vi.fn(async () => new Response(JSON.stringify({ avatar_url: null })));
    const missing = vi.fn(async () => new Response("", { status: 404 }));
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await gitlabAvatarUrl(group, empty as unknown as typeof fetch)).toBeNull();
    expect(await gitlabAvatarUrl(group, missing as unknown as typeof fetch)).toBeNull();
    expect(await gitlabAvatarUrl(group, failing as unknown as typeof fetch)).toBeNull();
    expect(await gitlabAvatarUrl(ownerOfRepository("https://github.com/a/b")!, failing as unknown as typeof fetch)).toBeNull();
  });
});

describe("readRepositoriesConfig", () => {
  it("keeps the url and the listed services and drops what is not a provider", () => {
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

describe("loadRepositoriesConfig", () => {
  it("reads the component list, and an empty one without a file", async () => {
    expect((await loadRepositoriesConfig(path.join(FIXTURES, "repositories.yml"))).repositories).toHaveLength(4);
    expect(await loadRepositoriesConfig(path.join(FIXTURES, "missing.yml"))).toEqual({ repositories: [] });
  });

  it("reads config/repositories.yml unless CGC_REPOSITORIES_FILE names another file", () => {
    expect(repositoriesFile({})).toBe(path.resolve("config/repositories.yml"));
    expect(repositoriesFile({ CGC_REPOSITORIES_FILE: "/tmp/list.yml" })).toBe("/tmp/list.yml");
  });

  it("finds a provider for every component of the seed list", async () => {
    const config = await loadRepositoriesConfig(path.resolve(__dirname, "../../config/repositories.yml"));
    const providers = collectProviders([], config);
    expect(providers.reduce((sum, provider) => sum + provider.components.length, 0)).toBe(config.repositories.length);
    expect(new Set(providers.map((provider) => provider.slug)).size).toBe(providers.length);
  });
});

describe("listedServicesByComponent", () => {
  it("gives the listed services by owner/repo", async () => {
    const services = listedServicesByComponent(await loadRepositoriesConfig(path.join(FIXTURES, "repositories.yml")));
    expect(services["open-zaak/open-zaak"]).toEqual([
      { name: "Maykin Media", url: "https://www.maykinmedia.nl", services: ["maintenance", "hosting"] },
      { name: "Open Zaak", url: null, services: ["support"] },
    ]);
    expect(services["ConductionNL/opencatalogi"]).toBeUndefined();
  });
});

describe("contactHref", () => {
  it("links a web address as is and an e-mail address with mailto", () => {
    expect(contactHref("https://example.org/contact")).toBe("https://example.org/contact");
    expect(contactHref("info@example.org")).toBe("mailto:info@example.org");
    expect(contactHref("call us")).toBeNull();
  });
});
