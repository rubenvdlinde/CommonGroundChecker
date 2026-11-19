import {
  getOrganisation,
  getOrganisations,
  getRepoHistory,
  getRepositories,
  getRepositoryUsage,
} from "@/lib/apiClient";
import type { DataSource } from "./types";

/** Each read calls the API client only when it is made. */
export const apiDataSource: DataSource = {
  kind: "api",
  listRepositories: ({ limit = 50, q } = {}) => getRepositories(limit, q),
  getRepoHistory: async (owner, repo, limit = 50) => {
    try {
      return await getRepoHistory(owner, repo, limit);
    } catch {
      return null;
    }
  },
  getRepositoryUsage: async (repoId) => {
    try {
      return await getRepositoryUsage(repoId);
    } catch {
      return null;
    }
  },
  getOrganisations: () => getOrganisations(),
  getOrganisation: (slug) => getOrganisation(slug),
};
