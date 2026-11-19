import type {
  OrganisationDetail,
  OrganisationList,
  RepoHistoryResponse,
  RepoSummary,
  UsageStatus,
} from "@/generated/openapi-client";
import type { ServiceProvider } from "@/lib/staticSite/config";
import type { StatusCounts } from "@/lib/staticSite/records";

/** Extra fields the static site gives an analysis of RepoHistoryResponse. */
export interface StaticAnalysisExtras {
  /** False for older runs: the static site keeps their summary, not their results */
  detailAvailable?: boolean;
  statusCounts?: StatusCounts;
}

/** What the component page shows about the repository beyond RepoHistoryResponse. */
export interface RepositoryExtras {
  basisset: boolean;
  providers: ServiceProvider[];
  retired: { on: string; reason: string } | null;
}

export type RepoHistory = RepoHistoryResponse & { extras?: RepositoryExtras };

/** The reads every page makes, implemented by the API client and by the static JSON files. */
export interface DataSource {
  kind: "api" | "static";
  listRepositories(options?: { limit?: number; q?: string }): Promise<RepoSummary[]>;
  /** Null when no analyses are stored for the repository */
  getRepoHistory(owner: string, repo: string, limit?: number): Promise<RepoHistory | null>;
  getRepositoryUsage(repoId: string): Promise<UsageStatus | null>;
  getOrganisations(): Promise<OrganisationList>;
  /** Null when no followed component declares the organisation */
  getOrganisation(slug: string): Promise<OrganisationDetail | null>;
}
