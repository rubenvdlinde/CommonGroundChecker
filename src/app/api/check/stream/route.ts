import { runChecks } from "@/lib/checkers";
import { countIssues } from "@/lib/issues";
import { getSupportedProviders, resolveRepositoryContext } from "@/lib/providers";
import type { CheckReport } from "@/lib/types";
import type { CheckResult as ApiCheckResult } from "@/generated/openapi-client/models/CheckResult";
import {
  postRepository,
  postRepositoryAnalysis,
  toPubliccodeRepositoryMetadata,
  type RepoMetadata,
  type RepoAnalysisInput,
} from "@/lib/apiClient";

export interface ProgressEvent {
  step: string;
  pct: number;
  done?: true;
  result?: CheckReport;
  error?: string;
}

function normalizeLocations(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
    : [];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function toApiString(value: string | null): string | undefined {
  return value ?? undefined;
}

function toApiCheckResult(result: import("@/lib/types").CheckResult): ApiCheckResult {
  return {
    ...result,
    requirementLevel: result.requirementLevel as ApiCheckResult["requirementLevel"],
    status: result.status as ApiCheckResult["status"],
    confidence: result.confidence as ApiCheckResult["confidence"],
  };
}

const formatSseEvent = (payload: ProgressEvent) =>
  `data: ${JSON.stringify(payload)}\n\n`;

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* ignore invalid JSON; continue with empty body */
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl : "";
  const helmChartLocations = normalizeLocations(body?.helmChartLocations);
  const documentationLocations = normalizeLocations(body?.documentationLocations);
  const dockerLocations = normalizeLocations(body?.dockerLocations);
  const apiSpecificationLocations = normalizeLocations(body?.apiSpecificationLocations);
  const isRegister = body?.isRegister === true;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: ProgressEvent) => {
        controller.enqueue(encoder.encode(formatSseEvent(payload)));
      };

      const finish = () => {
        controller.close();
      };

      if (!repoUrl) {
        send({ step: "Error", pct: 0, error: "Missing required field: repoUrl" });
        finish();
        return;
      }

      const repositoryContext = resolveRepositoryContext(repoUrl);
      if (!repositoryContext) {
        send({
          step: "Error",
          pct: 0,
          error: `Invalid repository URL. Supported providers: ${getSupportedProviders().join(", ")}.`,
        });
        finish();
        return;
      }

      try {
        send({ step: "Validating repository URL…", pct: 5 });

        const report = await runChecks(
          repoUrl,
          {
            helmChartLocations,
            documentationLocations,
            dockerLocations,
            apiSpecificationLocations,
            isRegister,
          },
          (step, pct) => send({ step, pct })
        );

        send({ step: "Saving results…", pct: 95 });

        const repositoryMetadata: RepoMetadata = {
          repoUrl: report.repoUrl,
          description: toApiString(report.repoMeta.description),
          language: toApiString(report.repoMeta.language),
          stars: report.repoMeta.stars,
          forks: report.repoMeta.forks,
          defaultBranch: report.repoMeta.defaultBranch,
          topics: report.repoMeta.topics,
          license: toApiString(report.repoMeta.license),
          version: toApiString(report.repoMeta.version),
          versionEvidenceSource: report.repoMeta.versionEvidence.source,
          versionEvidenceDetail: report.repoMeta.versionEvidence.detail,
          helmChartLocations,
          dockerLocations,
          apiSpecificationLocations,
          documentationLocations,
          ...toPubliccodeRepositoryMetadata(report.repoMeta),
        };

        try {
          const savedRepo = await postRepository(repositoryMetadata);
          const analysisInput: RepoAnalysisInput = {
            scoringConfigId: report.scoringConfigId,
            checkedAt: report.checkedAt,
            version: toApiString(report.repoMeta.version) ?? null,
            score: report.score,
            rating: report.rating,
            categoryRatings: report.categoryRatings,
            aspectRatings: report.aspectRatings,
            endorsement: report.endorsement,
            issueCounts: countIssues(report.results, report.rating, report.endorsement),
            results: report.results.map(toApiCheckResult),
          };

          await postRepositoryAnalysis(savedRepo.id, analysisInput);
        } catch (storageError) {
          console.error("Remote storage failed:", storageError);
          send({
            step: "Storage unavailable, returning local result",
            pct: 98,
          });
        }

        send({ step: "Analysis complete", pct: 100, done: true, result: report });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        const isNotFound = message.includes("404");
        const isRateLimited = /rate limit exceeded|api rate limit exceeded/i.test(
          message
        );

        send({
          step: "Error",
          pct: 0,
          error: isRateLimited
            ? "API rate limit reached. Add GITHUB_TOKEN or GITLAB_TOKEN in .env for higher limits, then restart the app."
            : isNotFound
            ? "Repository not found. Make sure it is public and the URL is correct."
            : message,
        });
      } finally {
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
