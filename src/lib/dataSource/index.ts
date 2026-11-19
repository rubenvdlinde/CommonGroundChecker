import { apiDataSource } from "./apiDataSource";
import { IS_STATIC_SITE } from "./mode";
import { staticDataSource } from "./staticDataSource";
import type { DataSource } from "./types";

export type { DataSource, RepoHistory, RepositoryExtras, StaticAnalysisExtras } from "./types";

/** The data source this build reads from: the static JSON files or the backend API. */
export function dataSource(): DataSource {
  return IS_STATIC_SITE ? staticDataSource() : apiDataSource;
}
