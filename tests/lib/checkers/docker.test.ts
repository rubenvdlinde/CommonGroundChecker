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

  it("passes buildiq's layout with a Dockerfile and compose.yaml under lib/Resources/deploy", () => {
    const result = checkDocker([
      "lib/Resources/deploy/Dockerfile",
      "lib/Resources/deploy/compose.yaml",
      "lib/Resources/deploy/buildiq-compose.yaml",
    ]);

    expect(result.status).toBe("pass");
  });
});
