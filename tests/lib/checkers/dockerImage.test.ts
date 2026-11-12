import { describe, expect, it } from "vitest";
import { checkDockerImage, findDeclaredImages, isImageDeclarationFile } from "@/lib/checkers/dockerImage";

describe("isImageDeclarationFile", () => {
  it.each(["docker-compose.yml", "deploy/compose.prod.yaml", "charts/app/values.yaml"])("accepts %s", (path) => {
    expect(isImageDeclarationFile(path)).toBe(true);
  });

  it.each(["Dockerfile", "src/values.ts", "config.yml"])("ignores %s", (path) => {
    expect(isImageDeclarationFile(path)).toBe(false);
  });
});

describe("findDeclaredImages", () => {
  it("finds an image of the repository itself in a compose file", () => {
    const images = findDeclaredImages(
      [{ path: "docker-compose.yml", content: "services:\n  app:\n    image: ghcr.io/Org/Repo:1.2.3\n" }],
      "org",
      "repo"
    );

    expect(images).toEqual(["ghcr.io/Org/Repo:1.2.3 (declared in docker-compose.yml)"]);
  });

  it("finds a Helm values repository and a Docker Hub reference without registry", () => {
    const images = findDeclaredImages(
      [
        { path: "charts/app/values.yaml", content: "image:\n  repository: ghcr.io/org/repo\n  tag: latest\n" },
        { path: "compose.yaml", content: "    image: org/repo@sha256:abc\n" },
      ],
      "org",
      "repo"
    );

    expect(images).toHaveLength(2);
  });

  it("ignores images of other projects", () => {
    const images = findDeclaredImages(
      [{ path: "docker-compose.yml", content: "    image: nextcloud:30\n    image: ghcr.io/org/repo-db:1\n    image: postgres:16\n" }],
      "org",
      "repo"
    );

    expect(images).toEqual([]);
  });
});

describe("checkDockerImage", () => {
  it("passes on a declared image when no location was provided", () => {
    const result = checkDockerImage([], ["ghcr.io/org/repo:1 (declared in docker-compose.yml)"]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toEqual(["ghcr.io/org/repo:1 (declared in docker-compose.yml)"]);
  });

  it("still fails without a location or a declared image", () => {
    expect(checkDockerImage([], []).status).toBe("fail");
  });

  it("keeps passing on a provided location", () => {
    expect(checkDockerImage(["ghcr.io/org/repo"]).status).toBe("pass");
  });
});
