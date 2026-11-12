import type { CheckReport } from "@/lib/types";
import { ApiClient } from "@/generated/openapi-client";
import type { ApiRequestOptions } from "@/generated/openapi-client/core/ApiRequestOptions";
import { getHeaders } from "@/generated/openapi-client/core/request";
import type {
  CheckRequest,
  FollowSettings,
  FollowSettingsInput,
  RepoAnalysisInput,
  RepoAnalysisOutput,
  RepoHistoryResponse,
  RepoMetadata,
  RepoSummary,
  ScoringConfigResponse,
} from "@/generated/openapi-client";

const remoteApiBaseUrl = process.env.URL?.replace(/\/$/, "") ?? "";
const localApiClient = new ApiClient({ BASE: "" });
const remoteApiClient = new ApiClient({ BASE: remoteApiBaseUrl });

function logApiRequest(clientName: "local" | "remote", method: string, path: string, body?: unknown) {
  const baseUrl =
    clientName === "remote"
      ? remoteApiClient.request.config.BASE ?? ""
      : localApiClient.request.config.BASE ?? "";
  const url = baseUrl ? `${baseUrl}${path}` : path;
  console.log("API request", { client: clientName, method, url, body });
}

export type {
  CheckRequest,
  FollowSettings,
  FollowSettingsInput,
  RepoSummary,
  RepoMetadata,
  RepoAnalysisInput,
  RepoAnalysisOutput,
  RepoHistoryResponse,
  ScoringConfigResponse,
};

interface StreamOptions {
  repoUrl: string;
  helmChartLocations?: string[];
  documentationLocations?: string[];
  dockerLocations?: string[];
  apiSpecificationLocations?: string[];
  isRegister?: boolean;
}

interface StreamProgressEvent {
  step: string;
  pct: number;
  done?: true;
  result?: CheckReport;
  error?: string;
}

const isServer = typeof window === "undefined";

function clientForRemoteCalls() {
  return isServer ? remoteApiClient : localApiClient;
}

export async function getRepositories(limit = 12, q?: string) {
  const client = clientForRemoteCalls();
  const clientName = isServer ? "remote" : "local";
  const search = q ? `&q=${encodeURIComponent(q)}` : "";
  logApiRequest(clientName, "GET", `/api/repositories?limit=${limit}${search}`);
  const response = await client.default.getApiRepositories(limit, q || undefined);
  return response.repositories ?? [];
}

export async function getRepoHistory(owner: string, repo: string, limit = 50) {
  const client = clientForRemoteCalls();
  const clientName = isServer ? "remote" : "local";
  logApiRequest(
    clientName,
    "GET",
    `/api/repo-history?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=${limit}`
  );
  return client.default.getApiRepoHistory(owner, repo, limit);
}

export async function getAdminScoring() {
  const client = clientForRemoteCalls();
  const clientName = isServer ? "remote" : "local";
  logApiRequest(clientName, "GET", "/api/admin/scoring");
  return client.default.getApiAdminScoring();
}

export async function postAdminScoring(payload: {
  reset?: boolean;
  criterionWeights?: Record<string, number>;
  criterionRequirementLevels?: Record<string, "mandatory" | "recommended">;
  categoryWeights?: Record<string, number>;
  complexityThreshold?: number;
  complexityMaxCcnThreshold?: number;
  spectralRulesetSource?: string;
}) {
  const client = clientForRemoteCalls();
  const clientName = isServer ? "remote" : "local";
  logApiRequest(clientName, "POST", "/api/admin/scoring", payload);
  return client.default.postApiAdminScoring(payload);
}

/** The publiccode.yml details of a report, in the shape POST /api/repositories accepts. */
export function toPubliccodeRepositoryMetadata(
  repoMeta: CheckReport["repoMeta"]
): Pick<
  RepoMetadata,
  "displayName" | "shortDescription" | "logoUrl" | "developmentStatus" | "maintenanceType" | "maintainers"
> {
  return {
    displayName: repoMeta.displayName ?? undefined,
    shortDescription: repoMeta.shortDescription ?? undefined,
    logoUrl: repoMeta.logoUrl ?? undefined,
    developmentStatus: repoMeta.developmentStatus ?? undefined,
    maintenanceType: repoMeta.maintenanceType ?? undefined,
    maintainers: repoMeta.maintainers,
  };
}

export async function postRepository(metadata: RepoMetadata) {
  logApiRequest("remote", "POST", "/api/repositories", metadata);
  return remoteApiClient.default.postApiRepositories(metadata);
}

export async function postRepositoryAnalysis(repoId: string, input: RepoAnalysisInput) {
  logApiRequest("remote", "POST", `/api/repositories/${encodeURIComponent(repoId)}/analyses`, input);
  return remoteApiClient.default.postApiRepositoriesAnalyses(repoId, input);
}

export async function putRepositoryFollow(
  repoId: string,
  settings: FollowSettingsInput,
  adminToken: string
): Promise<FollowSettings> {
  logApiRequest("local", "PUT", `/api/repositories/${encodeURIComponent(repoId)}/follow`, settings);
  const client = new ApiClient({ BASE: "", TOKEN: adminToken });
  return client.default.putApiRepositoriesFollow(repoId, settings);
}

export async function postCheck(request: CheckRequest) {
  logApiRequest("local", "POST", "/api/check", request);
  return localApiClient.default.postApiCheck(request);
}

export async function streamCheck(
  options: StreamOptions,
  onProgress?: (step: string, pct: number) => void
) {
  const requestOptions: ApiRequestOptions = {
    method: "POST",
    url: "/api/check/stream",
    body: options,
    mediaType: "application/json",
  };

  const baseUrl = localApiClient.request.config.BASE?.toString().replace(/\/$/, "") ?? "";
  const url = baseUrl ? `${baseUrl}/api/check/stream` : "/api/check/stream";
  const headers = await getHeaders(localApiClient.request.config, requestOptions);

  console.log("streamCheck request", {
    method: requestOptions.method,
    url,
    body: options,
  });

  const response = await fetch(url, {
    method: requestOptions.method,
    headers,
    body: JSON.stringify(options),
  });

  console.log("streamCheck response", {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    url: response.url,
  });

  if (!response.body) {
    throw new Error("No response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine.slice(6)) as StreamProgressEvent;
      console.log("streamCheck event", payload);

      if (payload.error) {
        throw new Error(payload.error);
      }

      onProgress?.(payload.step, payload.pct);

      if (payload.done && payload.result) {
        return payload.result;
      }
    }
  }

  throw new Error("Stream ended without producing a result.");
}
