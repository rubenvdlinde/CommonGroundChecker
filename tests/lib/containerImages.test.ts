import { describe, expect, it, vi } from "vitest";
import {
  confirmImageCandidates,
  findImageCandidates,
  imageExists,
  imageTextFiles,
  looseName,
} from "@/lib/containerImages";

const readme = (content: string) => [{ path: "README.rst", content }];

function fetchReturning(statusByUrl: Record<string, number>, body: unknown = {}) {
  return vi.fn(async (url: string | URL | Request) => {
    const status = statusByUrl[String(url)] ?? 404;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("looseName", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(looseName("Open-Zaak")).toBe("openzaak");
  });
});

describe("findImageCandidates", () => {
  it("matches an image whose namespace is the owner, loosely", () => {
    const candidates = findImageCandidates(
      readme("* `Docker image <https://hub.docker.com/r/openzaak/open-zaak>`_"),
      "open-zaak",
      "something-else"
    );

    expect(candidates).toEqual([{ registry: "dockerhub", image: "openzaak/open-zaak", foundIn: "README.rst" }]);
  });

  it("matches an image whose name is the repository name", () => {
    const candidates = findImageCandidates(readme("docker pull acme/open_zaak:1.2"), "someone", "open-zaak");

    expect(candidates).toEqual([{ registry: "dockerhub", image: "acme/open_zaak", foundIn: "README.rst" }]);
  });

  it("reads every supported form and keeps the first place an image is named", () => {
    const candidates = findImageCandidates(
      [
        {
          path: "README.md",
          content: [
            "https://hub.docker.com/repository/docker/org/a",
            "docker.io/org/b:1",
            "ghcr.io/Org/Repo:latest",
            "    image: org/c:2",
            "docker pull org/d.",
          ].join("\n"),
        },
        { path: "docs/install.md", content: "docker pull org/a" },
      ],
      "org",
      "repo"
    );

    expect(candidates.map((c) => `${c.registry}:${c.image}@${c.foundIn}`)).toEqual([
      "dockerhub:org/a@README.md",
      "dockerhub:org/b@README.md",
      "dockerhub:org/d@README.md",
      "dockerhub:org/c@README.md",
      "ghcr:org/repo@README.md",
    ]);
  });

  it("ignores images of other projects and reStructuredText image directives", () => {
    const candidates = findImageCandidates(
      readme(
        [
          ".. image:: https://img.shields.io/docker/image-size/openzaak/open-zaak",
          "docker pull postgres/postgres",
          "image: nginx/nginx:1",
          "ghcr.io/other/tool",
          "docker pull registry.example.com/org/repo",
        ].join("\n")
      ),
      "org",
      "repo"
    );

    expect(candidates).toEqual([]);
  });

  it("ignores Docker Hub library images", () => {
    expect(findImageCandidates(readme("docker.io/library/repo"), "org", "repo")).toEqual([]);
  });
});

describe("imageExists", () => {
  const hub = { registry: "dockerhub" as const, image: "org/repo", foundIn: "README.md" };
  const ghcr = { registry: "ghcr" as const, image: "org/repo", foundIn: "README.md" };

  it("confirms a Docker Hub image on 200", async () => {
    const fetchFn = fetchReturning({ "https://hub.docker.com/v2/repositories/org/repo/": 200 });

    expect(await imageExists(hub, { fetchFn })).toBe(true);
  });

  it("does not confirm a Docker Hub 404", async () => {
    expect(await imageExists(hub, { fetchFn: fetchReturning({}) })).toBe(false);
  });

  it("does not confirm on a network error", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    expect(await imageExists(hub, { fetchFn })).toBe(false);
  });

  it("follows the anonymous GHCR token flow", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === "https://ghcr.io/token?scope=repository:org/repo:pull") {
        return new Response(JSON.stringify({ token: "abc" }), { status: 200 });
      }
      const authorised = (init?.headers as Record<string, string> | undefined)?.Authorization === "Bearer abc";
      return new Response("{}", { status: String(url) === "https://ghcr.io/v2/org/repo/tags/list" && authorised ? 200 : 401 });
    }) as unknown as typeof fetch;

    expect(await imageExists(ghcr, { fetchFn })).toBe(true);
  });

  it("does not confirm a GHCR image without a token", async () => {
    const fetchFn = fetchReturning({ "https://ghcr.io/token?scope=repository:org/repo:pull": 200 }, {});

    expect(await imageExists(ghcr, { fetchFn })).toBe(false);
  });
});

describe("confirmImageCandidates", () => {
  it("keeps only confirmed candidates and looks up at most the limit", async () => {
    const fetchFn = fetchReturning({
      "https://hub.docker.com/v2/repositories/org/a/": 200,
      "https://hub.docker.com/v2/repositories/org/c/": 200,
    });
    const candidates = ["a", "b", "c"].map((name) => ({
      registry: "dockerhub" as const,
      image: `org/${name}`,
      foundIn: "README.md",
    }));

    expect(await confirmImageCandidates(candidates, { fetchFn, limit: 2 })).toEqual([
      "org/a on Docker Hub (named in README.md, found on the registry)",
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("imageTextFiles", () => {
  it("takes root READMEs first, then docs, capped", () => {
    const tree = ["docs/a.md", "src/README.md", "README.rst", "docs/b.rst", "docs/c.txt", "docs/d.md"];

    expect(imageTextFiles(tree, 3)).toEqual(["README.rst", "docs/a.md", "docs/b.rst"]);
  });
});
