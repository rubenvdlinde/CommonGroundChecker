import type { CheckResult } from "../types";

const DOCKER_FILES = [
  "dockerfile",
  "dockerfile.dev",
  "dockerfile.prod",
  "dockerfile.local",
  "containerfile",
  "containerfile.dev",
  "containerfile.prod",
  "containerfile.local",
];
const BUILD_DIRECTORIES = ["docker", "build", "deploy", ".docker", "container"];
const COMPOSE_FILES = [
  "docker-compose.yml",
  "docker-compose.yaml",
  "docker-compose.dev.yml",
  "docker-compose.prod.yml",
];

/**
 * A Dockerfile builds the component itself when it sits at the repository
 * root, directly in a conventional build directory, or in
 * docker/<repository-name>/. Dockerfiles elsewhere usually build sidecars,
 * test fixtures or tooling.
 */
function isComponentDockerfile(path: string, repoName?: string): boolean {
  const directories = path.toLowerCase().split("/").slice(0, -1);
  if (directories.length === 0) return true;
  if (directories.length === 1) return BUILD_DIRECTORIES.includes(directories[0]);
  return (
    directories.length === 2 &&
    directories[0] === "docker" &&
    repoName !== undefined &&
    directories[1] === repoName.toLowerCase()
  );
}

export function checkDocker(tree: string[], repoName?: string): CheckResult {
  const lowerTree = tree.map((p) => p.toLowerCase());

  const allDockerfiles = tree.filter((p) =>
    DOCKER_FILES.includes(p.toLowerCase().split("/").pop()!)
  );
  const dockerfiles = allDockerfiles.filter((p) => isComponentDockerfile(p, repoName));
  const otherDockerfiles = allDockerfiles.filter((p) => !dockerfiles.includes(p));
  const composeFiles = tree.filter((p) =>
    COMPOSE_FILES.includes(p.toLowerCase().split("/").pop()!)
  );
  const hasPackageHelmChart = lowerTree.some(
    (p) => p === "chart.yaml" || p.includes("/chart.yaml")
  );

  const allEvidence = [...dockerfiles, ...composeFiles];
  if (hasPackageHelmChart) allEvidence.push("(Helm chart)");
  if (otherDockerfiles.length > 0) {
    allEvidence.push(`other Dockerfiles found: ${otherDockerfiles.join(", ")}`);
  }
  const otherDockerfilesNote = otherDockerfiles.length > 0
    ? " Dockerfiles outside the repository root and the conventional build directories (docker/, build/, deploy/, .docker/, container/, docker/<repository-name>/) do not count, because they usually build sidecars or tooling rather than the component."
    : "";

  if (dockerfiles.length === 0 && composeFiles.length === 0 && !hasPackageHelmChart) {
    return {
      id: "docker",
      title: "Docker support",
      description:
        "The component must be deployable as a container. A Dockerfile and optionally a docker-compose file should be present.",
      status: "fail",
      message:
        `No Dockerfile or docker-compose file found. Common Ground components must be containerisable.${otherDockerfilesNote}`,
      evidence: allEvidence,
      referenceUrl:
        "https://commonground.nl/cms/view/54476272/haven",
    };
  }

  if (dockerfiles.length > 0 && composeFiles.length > 0) {
    return {
      id: "docker",
      title: "Docker support",
      description:
        "The component must be deployable as a container. A Dockerfile and docker-compose file should be present.",
      status: "pass",
      message: `Dockerfile and docker-compose file(s) found.`,
      evidence: allEvidence,
      referenceUrl: "https://commonground.nl/cms/view/54476272/haven",
    };
  }

  return {
    id: "docker",
    title: "Docker support",
    description:
      "The component must be deployable as a container. A Dockerfile and docker-compose file should be present.",
    status: "fail",
    message:
      dockerfiles.length > 0
        ? "Dockerfile found but no docker-compose file. A docker-compose file is required for this checker."
        : `Docker-compose file found but no Dockerfile detected. A Dockerfile is required.${otherDockerfilesNote}`,
    evidence: allEvidence,
    referenceUrl: "https://commonground.nl/cms/view/54476272/haven",
  };
}
