import {
  getOrganisation,
  getOrganisations,
  getRepoHistory,
  getRepositories,
  getRepositoryUsage,
} from "@/lib/apiClient";
import { decisionFor, loadMaintainedDecisions } from "@/lib/maintainedDecisions";
import type { DataSource } from "./types";

/**
 * Each read calls the API client only when it is made. The maintenance
 * decisions are not stored in the backend: they come from
 * config/repositories.yml, as on the static site.
 */
export const apiDataSource: DataSource = {
  kind: "api",
  listRepositories: async ({ limit = 50, q } = {}) => {
    const [repositories, decisions] = await Promise.all([getRepositories(limit, q), loadMaintainedDecisions()]);
    return repositories.map((repository) =>
      Object.assign(repository, { maintainedDecision: decisionFor(decisions, repository.repoUrl) })
    );
  },
  getRepoHistory: async (owner, repo, limit = 50) => {
    try {
      const [history, decisions] = await Promise.all([getRepoHistory(owner, repo, limit), loadMaintainedDecisions()]);
      return history ? { ...history, maintainedDecision: decisionFor(decisions, history.repository?.repoUrl) } : history;
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
