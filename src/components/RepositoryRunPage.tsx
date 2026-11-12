import Link from "next/link";
import CategoryRatings from "@/components/CategoryRatings";
import CriteriaResults from "@/components/CriteriaResults";
import FollowControl from "@/components/FollowControl";
import IssueBlocks from "@/components/IssueBlocks";
import RatingHistoryChart from "@/components/RatingHistoryChart";
import RatingSummary from "@/components/RatingSummary";
import RepoMeta from "@/components/RepoMeta";
import RunList from "@/components/RunList";
import { repositoryRunHref, type RepositoryRunResult } from "@/lib/repositoryRun";

interface RepositoryRunPageProps {
  owner: string;
  repo: string;
  result: RepositoryRunResult;
}

const SECTION_CLASS = "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4";

/**
 * A repository with one of its runs in full: the repository page shows the
 * latest run, a run page the requested one. Both list every run and graph
 * the overall rating over time.
 */
export default function RepositoryRunPage({ owner, repo, result }: RepositoryRunPageProps) {
  if (result.kind !== "found") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        <h2 className="text-2xl font-bold text-cg-blue">Component rating</h2>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {result.kind === "missing-repository"
            ? `No saved analyses found for ${owner}/${repo}.`
            : `Analysis not found for ${owner}/${repo}.`}
        </p>
        <Link
          href={result.kind === "missing-repository" ? "/history" : repositoryRunHref(owner, repo)}
          className="text-cg-lightblue hover:underline text-sm"
        >
          {result.kind === "missing-repository" ? "← Back to history search" : "← See the latest run"}
        </Link>
      </div>
    );
  }

  const { repository, repoMeta, runs, selected, latestId } = result.run;
  const analysisHref = (analysisId: string) => repositoryRunHref(repository.owner, repository.name, analysisId);
  const latestHref = repositoryRunHref(repository.owner, repository.name);
  const isOlder = selected !== null && selected.id !== latestId;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-cg-blue">Component rating</h2>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/history" className="text-cg-lightblue hover:underline">
            Search another repository
          </Link>
          <Link href="/" className="text-cg-lightblue hover:underline">
            Run new check
          </Link>
        </div>
      </div>

      <RepoMeta owner={repository.owner} repo={repository.name} repoMeta={repoMeta} followed={repository.followed} />

      {isOlder && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
          This is an older run, from {new Date(selected.checkedAt).toLocaleString("nl-NL")}.{" "}
          <Link href={latestHref} className="font-semibold underline hover:text-cg-blue">
            See the latest run
          </Link>
        </p>
      )}

      {selected === null ? (
        <section className={SECTION_CLASS}>
          <p className="text-sm text-gray-500">No analyses stored yet.</p>
        </section>
      ) : (
        <section aria-labelledby="run-summary-heading" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
          <h3 id="run-summary-heading" className="text-lg font-semibold text-gray-800">
            {isOlder ? "Older run" : "Latest run"}
          </h3>
          <p className="text-xs text-gray-500">
            Checked at {new Date(selected.checkedAt).toLocaleString("nl-NL")}
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <RatingSummary rating={selected.rating} endorsement={selected.endorsement} score={selected.score} />
            <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50">
              Version: {selected.version ?? repoMeta.version ?? "unknown"}
            </span>
          </div>
        </section>
      )}

      {selected && selected.results.length > 0 && (
        <IssueBlocks results={selected.results} rating={selected.rating} endorsement={selected.endorsement} />
      )}

      <section aria-labelledby="rating-history-heading" className={SECTION_CLASS}>
        <h3 id="rating-history-heading" className="text-lg font-semibold text-gray-800">
          Rating over time
        </h3>
        <RatingHistoryChart runs={runs} selectedId={selected?.id ?? null} analysisHref={analysisHref} />
      </section>

      {selected && selected.results.length > 0 && (
        <CategoryRatings
          results={selected.results}
          categoryRatings={selected.categoryRatings}
          aspectRatings={selected.aspectRatings}
        />
      )}

      <section aria-labelledby="all-runs-heading" className={SECTION_CLASS}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 id="all-runs-heading" className="text-lg font-semibold text-gray-800">
            All runs
          </h3>
          <span className="text-sm text-gray-500">
            {runs.length} run{runs.length === 1 ? "" : "s"}
          </span>
        </div>
        <RunList runs={runs} selectedId={selected?.id ?? null} analysisHref={analysisHref} />
      </section>

      <FollowControl
        repoId={repository.id}
        initialFollowed={repository.followed}
        initialCheckIntervalHours={repository.checkIntervalHours}
        initialNextCheckAt={repository.nextCheckAt}
      />

      {selected && <CriteriaResults results={selected.results} categoryRatings={selected.categoryRatings} />}
    </div>
  );
}
