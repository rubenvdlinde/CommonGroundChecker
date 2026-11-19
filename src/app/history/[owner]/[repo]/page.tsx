import Link from "next/link";
import MaintainedSection from "@/components/MaintainedSection";
import FollowControl from "@/components/FollowControl";
import RepoMeta from "@/components/RepoMeta";
import RatingBadge from "@/components/RatingBadge";
import UsageHistoryChart from "@/components/UsageHistoryChart";
import ProvidersSection from "@/components/ProvidersSection";
import { dataSource, type StaticAnalysisExtras } from "@/lib/dataSource";
import { IS_STATIC_SITE, STATIC_SITE_LINKS } from "@/lib/dataSource/mode";
import { staticRepositoryParams } from "@/lib/dataSource/staticDataSource";
import { developmentStatusOf, minUsers } from "@/lib/maintained";
import { organisationSlugsByKey } from "@/lib/organisations";
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

/** Every component page in the static export; the server renders them on request. */
export const generateStaticParams = IS_STATIC_SITE ? staticRepositoryParams : undefined;

function summarizeStatuses(results: unknown, stored?: StaticAnalysisExtras["statusCounts"]): {
  pass: number;
  warn: number;
  fail: number;
  info: number;
  total: number;
} {
  if (stored) {
    return { ...stored, total: stored.pass + stored.warn + stored.fail + stored.info };
  }
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
  const source = dataSource();
  const { owner: rawOwner, repo: rawRepo } = await params;
  const owner = decodeURIComponent(rawOwner);
  const repo = decodeURIComponent(rawRepo);

  const repositoryResponse = await source.getRepoHistory(owner, repo, 50);

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
  const usage = await source.getRepositoryUsage(repository.id);
  const extras = repositoryResponse?.extras;
  let organisationSlugs: Record<string, string> = {};
  try {
    organisationSlugs = Object.fromEntries(organisationSlugsByKey((await source.getOrganisations()).organisations ?? []));
  } catch {
    organisationSlugs = {};
  }
  const minimumUsers = minUsers();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      {!IS_STATIC_SITE && (
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
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-cg-blue">Repository History</h2>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/history" className="text-cg-lightblue hover:underline">
            Search another repository
          </Link>
          <Link href="/" className="text-cg-lightblue hover:underline">
            {IS_STATIC_SITE ? "Add a component" : "Run new check"}
          </Link>
        </div>
      </div>

      <RepoMeta owner={repository.owner} repo={repository.name} repoMeta={repoMeta} />

      <MaintainedSection
        repoId={repository.id}
        endorsement={ratings[0]?.endorsement ?? { passed: false, reasons: ["Not scanned yet"] }}
        developmentStatus={developmentStatusOf(analyses[0]?.results ?? [])}
        initialUsage={usage}
        minUsers={minimumUsers}
        today={new Date().toISOString().slice(0, 10)}
        organisationSlugs={organisationSlugs}
        readOnly={IS_STATIC_SITE}
      />

      {extras && <ProvidersSection providers={extras.providers} listUrl={STATIC_SITE_LINKS.componentList} />}

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Users over time</h3>
        <UsageHistoryChart analyses={analyses} minUsers={minimumUsers} />
      </section>

      {IS_STATIC_SITE ? (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">Follow</h3>
          {extras?.retired ? (
            <p className="text-sm text-gray-700">
              Retired on {extras.retired.on}: {extras.retired.reason}. It is no longer scanned; these are its last results.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              On the{" "}
              <a href={STATIC_SITE_LINKS.componentList} className="text-cg-lightblue hover:underline">
                component list
              </a>
              , so it is scanned every night.
              {extras?.basisset ? " It is part of the Common Ground basisset." : ""}
            </p>
          )}
        </section>
      ) : (
        <FollowControl
          repoId={repository.id}
          initialFollowed={repository.followed ?? false}
          initialCheckIntervalHours={repository.checkIntervalHours ?? null}
          initialScanRef={repository.scanRef ?? null}
          initialNextCheckAt={repository.nextCheckAt ?? null}
        />
      )}

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
              const stored = analysis as typeof analysis & StaticAnalysisExtras;
              const stats = summarizeStatuses(analysis.results, stored.statusCounts);
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
                    {stored.detailAvailable === false ? (
                      <span className="text-xs text-gray-500">Summary only</span>
                    ) : (
                      <Link
                        href={`/history/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/${encodeURIComponent(analysis.id)}`}
                        className="text-sm text-cg-lightblue hover:underline"
                      >
                        View details
                      </Link>
                    )}
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
