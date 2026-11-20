/**
 * The owner of a component's repository: the GitHub organisation or user, or
 * the GitLab group, that hosts it. The Providers pages list components by it.
 */
import { repositoryPath } from "@/lib/staticSite/config";
import { providerHref } from "@/lib/routes";

/** The owner of a repository on its host. */
export interface RepositoryOwner {
  slug: string;
  /** The owner as the repository URL names it; a GitLab group path can contain "/" */
  name: string;
  host: string;
  /** "GitHub", "GitLab", or the host name for any other host */
  hostLabel: string;
  /** The owner's page on the host */
  url: string;
}

const HOST_LABELS: Record<string, string> = { "github.com": "GitHub", "gitlab.com": "GitLab" };

function slugPart(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The address of an owner's page. A GitHub owner keeps its login in lower
 * case; another host comes first, and each group of a GitLab path becomes
 * one part, so gitlab.com/a.b/c gives gitlab--a-b--c. GitHub logins never
 * hold "--", so the two cannot meet.
 */
export function ownerSlug(host: string, owner: string): string {
  const parts = owner.split("/").map(slugPart).filter(Boolean);
  if (host === "github.com") return parts.join("--");
  const hostPart = host === "gitlab.com" ? "gitlab" : slugPart(host);
  return [hostPart, ...parts].join("--");
}

/** The owner of a repository URL; null for a URL that names no repository. */
export function ownerOfRepository(repoUrl: string): RepositoryOwner | null {
  let location;
  try {
    location = repositoryPath(repoUrl);
  } catch {
    return null;
  }
  return {
    slug: ownerSlug(location.host, location.owner),
    name: location.owner,
    host: location.host,
    hostLabel: HOST_LABELS[location.host] ?? location.host,
    url: `https://${location.host}/${location.owner}`,
  };
}

/** The provider page of a repository's owner; null for a URL that names no repository. */
export function ownerHref(repoUrl: string): string | null {
  const owner = ownerOfRepository(repoUrl);
  return owner?.slug ? providerHref(owner.slug) : null;
}
