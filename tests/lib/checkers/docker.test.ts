import { describe, expect, it } from "vitest";
import { checkDocker } from "@/lib/checkers/docker";

describe("checkDocker compose file names", () => {
  it.each([
    "compose.yaml",
    "compose.yml",
    "docker-compose.yml",
    "docker-compose.yaml",
    "docker-compose.dev.yml",
    "docker-compose.prod.yaml",
    "docker-compose.override.yml",
    "compose.prod.yaml",
    "compose.override.yml",
    "deploy/buildiq-compose.yaml",
    "lib/Resources/deploy/compose.yaml",
  ])("recognises %s as a compose file", (composePath) => {
    const result = checkDocker(["Dockerfile", composePath]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(composePath);
  });

  it.each([
    "composer.yaml",
    "decompose.yml",
    "compose.json",
    "docs/compose.md",
  ])("does not treat %s as a compose file", (path) => {
    const result = checkDocker(["Dockerfile", path]);

    expect(result.status).toBe("fail");
    expect(result.evidence).not.toContain(path);
  });

  it("recognises buildiq's compose files under lib/Resources/deploy", () => {
    const result = checkDocker(
      [
        "lib/Resources/deploy/Dockerfile",
        "lib/Resources/deploy/compose.yaml",
        "lib/Resources/deploy/buildiq-compose.yaml",
      ],
      "buildiq"
    );

    expect(result.evidence).toContain("lib/Resources/deploy/compose.yaml");
    expect(result.evidence).toContain("lib/Resources/deploy/buildiq-compose.yaml");
    expect(result.message).toContain("no Dockerfile detected");
  });
});

describe("checkDocker Dockerfile location", () => {
  it.each([
    "Dockerfile",
    "Dockerfile.prod",
    "Containerfile",
    "docker/Dockerfile",
    "build/Dockerfile",
    "deploy/Dockerfile",
    ".docker/Dockerfile",
    "container/Containerfile",
    "docker/open-zaak/Dockerfile",
  ])("counts %s as the component's Dockerfile", (dockerfile) => {
    const result = checkDocker([dockerfile, "docker-compose.yml"], "open-zaak");

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(dockerfile);
  });

  it("does not pass on a sidecar Dockerfile alone (openregister's docker/dolphin/Dockerfile)", () => {
    const result = checkDocker(
      ["docker/dolphin/Dockerfile", "docker-compose.yml", "docker-compose.dev.yml"],
      "openregister"
    );

    expect(result.status).toBe("fail");
    expect(result.message).toContain("no Dockerfile detected");
    expect(result.evidence).toContain("other Dockerfiles found: docker/dolphin/Dockerfile");
  });

  it("does not pass on tooling and integration Dockerfiles (keepiq layout)", () => {
    const result = checkDocker(
      [
        "cli/Dockerfile",
        "integrations/kubernetes/Dockerfile",
        "integrations/runner/Dockerfile",
        "docker-compose.yml",
      ],
      "keepiq"
    );

    expect(result.status).toBe("fail");
    expect(result.evidence).toContain(
      "other Dockerfiles found: cli/Dockerfile, integrations/kubernetes/Dockerfile, integrations/runner/Dockerfile"
    );
  });

  it("does not count a nested deploy directory such as lib/Resources/deploy/", () => {
    const result = checkDocker(["lib/Resources/deploy/Dockerfile", "docker-compose.yml"], "buildiq");

    expect(result.status).toBe("fail");
  });

  it("lists other Dockerfiles as evidence when the component Dockerfile passes", () => {
    const result = checkDocker(
      ["Dockerfile", "docker/dolphin/Dockerfile", "docker-compose.yml"],
      "openregister"
    );

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("Dockerfile");
    expect(result.evidence).toContain("other Dockerfiles found: docker/dolphin/Dockerfile");
  });

  it("only accepts docker/<name>/ when the name matches the repository", () => {
    expect(checkDocker(["docker/open-zaak/Dockerfile", "docker-compose.yml"]).status).toBe("fail");
    expect(checkDocker(["docker/other/Dockerfile", "docker-compose.yml"], "open-zaak").status).toBe("fail");
  });
});
