import Link from "next/link";
import CategoryRatings from "@/components/CategoryRatings";
import IssueBlocks from "@/components/IssueBlocks";
import ResultCard from "@/components/ResultCard";
import RatingBadge from "@/components/RatingBadge";
import RatingSummary from "@/components/RatingSummary";
import { derivedStarRating } from "@/lib/stars";
import { getRepoHistory } from "@/lib/apiClient";
import { parseMeasurements } from "@/lib/measurements";
import { isRating } from "@/lib/ratings";
import { loadStoredRatings } from "@/lib/storedRatings";
import type { CheckReport, CheckResult, StarRating } from "@/lib/types";
import type { RepoMeta } from "@/generated/openapi-client";
import { CATEGORY_ORDER, RESULT_CATEGORY_BY_ID, RESULT_ORDER_BY_ID } from "@/lib/criteria";

interface AnalysisDetailPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    analysisId: string;
  }>;
}

function normalizeResults(raw: unknown): CheckResult[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const requirementLevel =
        item.requirementLevel === "mandatory" ||
        item.requirementLevel === "recommended" ||
        item.requirementLevel === "informative"
          ? item.requirementLevel
          : undefined;

      return {
        id: typeof item.id === "string" ? item.id : "unknown",
        title: typeof item.title === "string" ? item.title : "Unknown check",
        description: typeof item.description === "string" ? item.description : "",
        requirementLevel,
        confidence:
          item.confidence === "high" ||
          item.confidence === "medium" ||
          item.confidence === "low"
            ? item.confidence
            : undefined,
        status:
          item.status === "pass" ||
          item.status === "warn" ||
          item.status === "fail" ||
          item.status === "info"
            ? item.status
            : "info",
        message:
          typeof item.message === "string" ? item.message : "No detail message available.",
        evidence: Array.isArray(item.evidence)
          ? item.evidence.filter((value): value is string => typeof value === "string")
          : [],
        referenceUrl:
          typeof item.referenceUrl === "string" ? item.referenceUrl : undefined,
        starRating:
          typeof item.starRating === "number" && Number.isInteger(item.starRating) && item.starRating >= 1 && item.starRating <= 5
            ? (item.starRating as StarRating)
            : undefined,
        rating: isRating(item.rating) ? item.rating : undefined,
        measurements: parseMeasurements(item.measurements),
      } satisfies CheckResult;
    });
}

function normalizeRepoMeta(raw: RepoMeta): CheckReport["repoMeta"] {
  const source = raw.versionEvidence?.source;

  return {
    description: raw.description,
    language: raw.language,
    stars: raw.stars,
    forks: raw.forks,
    defaultBranch: raw.defaultBranch ?? "main",
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    license: raw.license,
    version: raw.version,
    versionEvidence: {
      source:
        source === "release" ||
        source === "tag" ||
        source === "manifest" ||
        source === "readme" ||
        source === "none"
          ? source
          : "none",
      detail:
        typeof raw.versionEvidence?.detail === "string"
          ? raw.versionEvidence.detail
          : "No saved version evidence for this historical record",
    },
    displayName: raw.displayName ?? null,
    shortDescription: raw.shortDescription ?? null,
    logoUrl: raw.logoUrl ?? null,
    developmentStatus: raw.developmentStatus ?? null,
    maintenanceType: raw.maintenanceType ?? null,
    maintainers: Array.isArray(raw.maintainers) ? raw.maintainers : [],
  };
}

export default async function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
  const { owner: rawOwner, repo: rawRepo, analysisId: rawAnalysisId } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);
  const analysisId = decodeURIComponent(rawAnalysisId);

  let historyResponse;
  try {
    historyResponse = await getRepoHistory(owner, repo, 50);
  } catch (error) {
    historyResponse = null;
  }

  const repository = historyResponse?.repository;
  const analysis = historyResponse?.analyses?.find((analysisItem) => analysisItem.id === analysisId);

  if (!repository || !analysis) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        <h2 className="text-2xl font-bold text-cg-blue">Analysis Details</h2>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          Analysis not found for {owner}/{repo}.
        </p>
        <Link
          href={`/history/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
          className="text-cg-lightblue hover:underline text-sm"
        >
          ← Back to repository history
        </Link>
      </div>
    );
  }

  const results = normalizeResults(analysis.results);
  const repoMeta = normalizeRepoMeta(repository.metadata);
  const [{ rating, categoryRatings, aspectRatings, endorsement }] = await loadStoredRatings([analysis]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-cg-blue">Analysis Details</h2>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/history/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
            className="text-cg-lightblue hover:underline"
          >
            Back to repository history
          </Link>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
        <p className="text-sm text-gray-800 font-semibold">
          {owner}/{repo}
        </p>
        <p className="text-xs text-gray-500">
          Checked at {new Date(analysis.checkedAt).toLocaleString("nl-NL")}
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <RatingSummary rating={rating} endorsement={endorsement} score={analysis.score} />
          <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50">
            Version: {analysis.version ?? repoMeta.version ?? "unknown"}
          </span>
        </div>
      </section>

      {results.length > 0 && <IssueBlocks results={results} rating={rating} endorsement={endorsement} />}

      {results.length > 0 && (
        <CategoryRatings results={results} categoryRatings={categoryRatings} aspectRatings={aspectRatings} />
      )}

      <section className="space-y-1">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-600">
          Criteria results for this run
        </h3>
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50 font-semibold uppercase tracking-wide">
            High confidence
          </span>
          <span className="px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50/70 font-semibold uppercase tracking-wide">
            Medium confidence
          </span>
          <span className="px-2 py-0.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50/40 font-semibold uppercase tracking-wide">
            Low confidence
          </span>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          Confidence indicates how strong the ownership evidence is: high = explicit legal statement, medium = manifest metadata, low = repository-owner fallback or weak evidence.
        </p>
        {results.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-3">
            No detailed criteria were stored for this analysis.
          </p>
        ) : (
          <div className="space-y-2">
            {CATEGORY_ORDER.map((category) => {
              const sortedResults = results
                .filter((r) => RESULT_CATEGORY_BY_ID[r.id] === category)
                .sort((a, b) => {
                  const indexA = RESULT_ORDER_BY_ID.indexOf(a.id);
                  const indexB = RESULT_ORDER_BY_ID.indexOf(b.id);
                  const safeIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
                  const safeIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
                  return safeIndexA - safeIndexB;
                });

              if (sortedResults.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-3 mt-4 mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {category}
                    </h4>
                    <RatingBadge rating={categoryRatings[category] ?? null} label={`${category} rating`} />
                  </div>
                  <div className="space-y-2">
                    {sortedResults.map((result, index) => (
                      <ResultCard
                        key={`${result.id}-${index}`}
                        id={result.id}
                        title={result.title}
                        description={result.description}
                        requirementLevel={result.requirementLevel}
                        confidence={result.confidence}
                        status={result.status}
                        message={result.message}
                        evidence={result.evidence}
                        referenceUrl={result.referenceUrl}
                        starRating={derivedStarRating(result)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
