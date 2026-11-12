import Link from "next/link";
import RepoMeta from "@/components/RepoMeta";
import RatingBadge from "@/components/RatingBadge";
import { getRepoHistory } from "@/lib/apiClient";
import { loadStoredRatings } from "@/lib/storedRatings";
import type { CheckReport } from "@/lib/types";
import type { RepoMeta as RepoMetaType } from "@/generated/openapi-client";

interface HistoryPageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

function normalizeRepoMeta(raw: RepoMetaType): CheckReport["repoMeta"] {
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

function summarizeStatuses(results: unknown): {
  pass: number;
  warn: number;
  fail: number;
  info: number;
  total: number;
} {
  if (!Array.isArray(results)) {
    return { pass: 0, warn: 0, fail: 0, info: 0, total: 0 };
  }

  let pass = 0;
  let warn = 0;
  let fail = 0;
  let info = 0;

  for (const item of results) {
    const status =
      item && typeof item === "object" && "status" in item
        ? (item as { status?: unknown }).status
        : undefined;

    if (status === "pass") pass += 1;
    else if (status === "warn") warn += 1;
    else if (status === "fail") fail += 1;
    else if (status === "info") info += 1;
  }

  const total = pass + warn + fail + info;
  return { pass, warn, fail, info, total };
}

function badgeClass(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-700 border-green-300";
  if (score >= 60) return "bg-yellow-100 text-yellow-700 border-yellow-300";
  return "bg-red-100 text-red-700 border-red-300";
}

export default async function RepoHistoryPage({ params }: HistoryPageProps) {
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  let repositoryResponse;
  try {
    repositoryResponse = await getRepoHistory(owner, repo, 50);
  } catch (error) {
    repositoryResponse = null;
  }

  const repository = repositoryResponse?.repository;

  if (!repository) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        <h2 className="text-2xl font-bold text-cg-blue">Repository History</h2>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          No saved analyses found for {owner}/{repo}.
        </p>
        <Link href="/history" className="text-cg-lightblue hover:underline text-sm">
          ← Back to history search
        </Link>
      </div>
    );
  }

  const repoMeta = normalizeRepoMeta(repository.metadata);
  const analyses = repositoryResponse?.analyses ?? [];
  const ratings = await loadStoredRatings(analyses);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <nav className="flex items-center justify-end gap-4 text-sm">
        <Link href="/" className="text-gray-500 hover:text-cg-lightblue transition-colors">
          Checker
        </Link>
        <Link href="/history" className="text-cg-lightblue hover:underline font-medium">
          History
        </Link>
        <Link href="/admin" className="text-gray-500 hover:text-cg-lightblue transition-colors">
          Admin
        </Link>
        <Link href="/about" className="text-gray-500 hover:text-cg-lightblue transition-colors">
          About
        </Link>
      </nav>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-cg-blue">Repository History</h2>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/history" className="text-cg-lightblue hover:underline">
            Search another repository
          </Link>
          <Link href="/" className="text-cg-lightblue hover:underline">
            Run new check
          </Link>
        </div>
      </div>

      <RepoMeta owner={repository.owner} repo={repository.name} repoMeta={repoMeta} />

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-gray-800">Historical analyses</h3>
          <span className="text-sm text-gray-500">
            {analyses.length} run{analyses.length === 1 ? "" : "s"}
          </span>
        </div>

        {analyses.length === 0 ? (
          <p className="text-sm text-gray-500">No analyses stored yet.</p>
        ) : (
          <div className="space-y-3">
            {analyses.map((analysis, index) => {
              const stats = summarizeStatuses(analysis.results);
              return (
                <div
                  key={analysis.id}
                  className="border border-gray-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {new Date(analysis.checkedAt).toLocaleString("nl-NL")}
                    </p>
                    <p className="text-xs text-gray-500">
                      pass {stats.pass} • warn {stats.warn} • fail {stats.fail}
                      {stats.info > 0 ? ` • info ${stats.info}` : ""}
                      {stats.total > 0 ? ` • total ${stats.total}` : ""}
                    </p>
                    <p className="text-xs text-purple-700">
                      Version: {analysis.version ?? "unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RatingBadge rating={ratings[index].rating} />
                    <span
                      className={`inline-flex items-center text-sm font-bold border rounded-full px-3 py-1 ${badgeClass(
                        analysis.score
                      )}`}
                    >
                      Score {analysis.score}
                    </span>
                    <Link
                      href={`/history/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/${encodeURIComponent(analysis.id)}`}
                      className="text-sm text-cg-lightblue hover:underline"
                    >
                      View details
                    </Link>
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
