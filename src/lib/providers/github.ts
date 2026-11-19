import {
  getCommitSha as getGitHubCommitSha,
  getFileContent as getGitHubFileContent,
  getRepoMeta as getGitHubRepoMeta,
  getRepoTree as getGitHubRepoTree,
  getRepoVersion as getGitHubRepoVersion,
  listReleases as listGitHubReleases,
  listTags as listGitHubTags,
  parseGitHubTreeUrl,
  parseGitHubUrl,
} from "../github";
import type {
  ParsedRepoTreeUrl,
  RepoContext,
  RepoIdentifier,
  RepositoryProvider,
} from "./types";
import { encodePathSegments } from "./paths";

export const GitHubRepositoryProvider: RepositoryProvider = {
  id: "github",
  hostname: "github.com",
  parseRepoUrl(url: string): RepoIdentifier | null {
    const parsed = parseGitHubUrl(url);
    if (!parsed) return null;
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      projectPath: `${parsed.owner}/${parsed.repo}`,
    };
  },
  getRepoMeta: async (context: RepoContext) =>
    getGitHubRepoMeta(context.owner, context.repo),
  getRepoTree: async (context: RepoContext, branch: string) =>
    getGitHubRepoTree(context.owner, context.repo, branch),
  getFileContent: async (context: RepoContext, path: string) =>
    getGitHubFileContent(
      context.owner,
      context.repo,
      path,
      context.ref ?? context.defaultBranch
    ),
  getRepoVersion: async (context: RepoContext) =>
    getGitHubRepoVersion(context.owner, context.repo),
  getCommitSha: async (context: RepoContext, ref: string) =>
    getGitHubCommitSha(context.owner, context.repo, ref),
  listReleases: async (context: RepoContext) =>
    listGitHubReleases(context.owner, context.repo),
  listTags: async (context: RepoContext) => listGitHubTags(context.owner, context.repo),
  getCloneUrl: (context: RepoContext) =>
    `https://github.com/${context.projectPath}.git`,
  getRawFileUrl: (context: RepoContext, branch: string, path: string) =>
    `https://raw.githubusercontent.com/${context.projectPath}/${encodePathSegments(branch)}/${encodePathSegments(path)}`,
  parseRepoTreeUrl: (url: string): ParsedRepoTreeUrl | null => {
    const parsed = parseGitHubTreeUrl(url);
    if (!parsed) return null;
    return {
      ...parsed,
      projectPath: `${parsed.owner}/${parsed.repo}`,
    };
  },
};
