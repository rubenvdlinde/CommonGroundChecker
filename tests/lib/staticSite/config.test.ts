import { describe, expect, it } from "vitest";
import {
  duplicateRepositories,
  normalizeRepositoryUrl,
  parseYaml,
  repositoryDataDir,
  repositoryId,
  repositoryPath,
  slasByRepository,
} from "@/lib/staticSite/config";

describe("normalizeRepositoryUrl", () => {
  it("drops a trailing slash, .git, query and hash, and lower-cases the host", () => {
    expect(normalizeRepositoryUrl(" https://GitHub.com/open-zaak/open-zaak.git/?tab=1#readme ")).toBe(
      "https://github.com/open-zaak/open-zaak"
    );
  });
});

describe("repositoryPath", () => {
  it("splits a GitHub URL into host, owner and name", () => {
    const path = repositoryPath("https://github.com/open-zaak/open-zaak");
    expect(path).toEqual({ host: "github.com", owner: "open-zaak", repo: "open-zaak" });
    expect(repositoryDataDir(path)).toBe("repositories/github.com/open-zaak/open-zaak");
    expect(repositoryId(path)).toBe("github.com/open-zaak/open-zaak");
  });

  it("keeps the full group path of a GitLab project as the owner", () => {
    const path = repositoryPath("https://gitlab.com/digilab.overheid.nl/ecosystem/ftv/open-ftv");
    expect(path).toEqual({ host: "gitlab.com", owner: "digilab.overheid.nl/ecosystem/ftv", repo: "open-ftv" });
    expect(repositoryDataDir(path)).toBe("repositories/gitlab.com/digilab.overheid.nl/ecosystem/ftv/open-ftv");
  });

  it("rejects a URL without owner and name", () => {
    expect(() => repositoryPath("https://github.com/open-zaak")).toThrow(/Not a repository URL/);
  });
});

describe("parseYaml", () => {
  it("keeps dates as YYYY-MM-DD text", () => {
    expect(parseYaml("start: 2026-01-01\n")).toEqual({ start: "2026-01-01" });
  });

  it("reads an empty file as an empty object", () => {
    expect(parseYaml("")).toEqual({});
  });
});

describe("duplicateRepositories", () => {
  it("finds a repository listed twice in different spellings", () => {
    expect(
      duplicateRepositories({
        repositories: [
          { url: "https://github.com/open-zaak/open-zaak" },
          { url: "https://github.com/Open-Zaak/open-zaak/" },
          { url: "https://github.com/open-zaak/open-notificaties" },
        ],
      })
    ).toEqual(["https://github.com/open-zaak/open-zaak"]);
  });
});

describe("slasByRepository", () => {
  it("groups SLAs by normalised repository URL", () => {
    const sla = { party: "VNG", maintainer: "Maykin", start: "2026-01-01", until: "2026-12-31" };
    const map = slasByRepository({
      slas: [
        { ...sla, repository: "https://github.com/open-zaak/open-zaak/" },
        { ...sla, repository: "https://github.com/open-zaak/open-zaak" },
      ],
    });
    expect(map.get("https://github.com/open-zaak/open-zaak")).toHaveLength(2);
  });
});
