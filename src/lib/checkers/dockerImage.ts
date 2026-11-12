import type { CheckResult } from "../types";

function normalizeDockerLocations(dockerLocations: string[] = []): string[] {
  return dockerLocations.map((value) => value.trim()).filter(Boolean);
}

/** Compose files and Helm values, where a component declares the image it is deployed from. */
const DECLARATION_FILE = /(^|\/)((docker-)?compose(\.[\w-]+)?|values)\.ya?ml$/i;
const IMAGE_REFERENCE = /^[ \t]*-?[ \t]*(?:image|repository)[ \t]*:[ \t]*["']?([^\s"'#]+)/gim;

export function isImageDeclarationFile(path: string): boolean {
  return DECLARATION_FILE.test(path);
}

/** Image references in the files that name the repository's own owner/repo, e.g. ghcr.io/owner/repo:1.0. */
export function findDeclaredImages(
  files: Array<{ path: string; content: string }>,
  owner: string,
  repo: string
): string[] {
  const ownPath = `${owner}/${repo}`.toLowerCase();
  const found = new Set<string>();
  for (const file of files) {
    for (const match of file.content.matchAll(IMAGE_REFERENCE)) {
      const reference = match[1].toLowerCase();
      const withoutTag = reference.split("@")[0].replace(/:[^/]*$/, "");
      if (withoutTag === ownPath || withoutTag.endsWith(`/${ownPath}`)) {
        found.add(`${match[1]} (declared in ${file.path})`);
      }
    }
  }
  return Array.from(found);
}

export function checkDockerImage(dockerLocations: string[] = [], declaredImages: string[] = []): CheckResult {
  const locations = normalizeDockerLocations(dockerLocations);

  if (locations.length === 0 && declaredImages.length > 0) {
    return {
      id: "dockerimage",
      title: "Available Docker image",
      description:
        "A published Docker image location should be available so deployments can pull a ready-to-run container image.",
      status: "pass",
      message: "The repository declares a published image of this component.",
      evidence: declaredImages,
      referenceUrl: "https://commonground.nl/cms/view/54476272/haven",
    };
  }

  if (locations.length === 0) {
    return {
      id: "dockerimage",
      title: "Available Docker image",
      description:
        "A published Docker image location should be available so deployments can pull a ready-to-run container image.",
      status: "fail",
      message:
        "No Docker image location was provided, and no compose file or Helm values in the repository reference an image of this repository. Add a registry/repository URL for the published image.",
      evidence: [],
      referenceUrl: "https://commonground.nl/cms/view/54476272/haven",
    };
  }

  return {
    id: "dockerimage",
    title: "Available Docker image",
    description:
      "A published Docker image location should be available so deployments can pull a ready-to-run container image.",
    status: "pass",
    message: "Docker image location provided.",
    evidence: locations,
    referenceUrl: "https://commonground.nl/cms/view/54476272/haven",
  };
}
