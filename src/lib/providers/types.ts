export interface RepoVersionResult {
  version: string | null;
  evidence: {
    source: "release" | "tag" | "manifest" | "readme" | "none";
    detail: string;
  };
}

export interface ParsedRepoTreeUrl {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  projectPath: string;
}

export interface RepoIdentifier {
  owner: string;
  repo: string;
  projectPath: string;
}

export interface RepoContext extends RepoIdentifier {
  provider: RepositoryProvider;
  repoUrl: string;
  defaultBranch?: string;
}

export interface RepositoryMeta {
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  default_branch?: string;
  topics?: string[];
  license?: {
    spdx_id?: string | null;
    name?: string | null;
  } | null;
  owner?: {
    name?: string;
    login?: string;
  };
  [key: string]: unknown;
}

export interface RepositoryProvider {
  id: string;
  hostname: string;
  parseRepoUrl(url: string): RepoIdentifier | null;
  getRepoMeta(context: RepoContext): Promise<RepositoryMeta>;
  getRepoTree(context: RepoContext, branch: string): Promise<string[]>;
  getFileContent(context: RepoContext, path: string): Promise<string | null>;
  getRepoVersion(context: RepoContext): Promise<RepoVersionResult>;
  getCloneUrl(context: RepoContext): string;
  /** URL that serves the raw content of a repository file on the given branch */
  getRawFileUrl(context: RepoContext, branch: string, path: string): string;
  parseRepoTreeUrl?(url: string): ParsedRepoTreeUrl | null;
}
