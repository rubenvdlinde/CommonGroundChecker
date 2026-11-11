import { describe, expect, it } from "vitest";
import { checkDocker } from "@/lib/checkers/docker";

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
