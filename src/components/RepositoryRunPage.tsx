import Link from "next/link";
import CategoryRatings from "@/components/CategoryRatings";
import CriteriaResults from "@/components/CriteriaResults";
import DropsCard from "@/components/DropsCard";
import FollowControl from "@/components/FollowControl";
import ScannedRef from "@/components/ScannedRef";
import ScanModeLine from "@/components/ScanModeLine";
import IssueBlocks from "@/components/IssueBlocks";
import LifecycleSection, { type RepositoryLifecycle } from "@/components/LifecycleSection";
import MaintainedSection from "@/components/MaintainedSection";
import FunctionalitiesSection, { type ComponentLandscape } from "@/components/FunctionalitiesSection";
import ProvidersSection from "@/components/ProvidersSection";
import PublicCodeSection from "@/components/PublicCodeSection";
import RatingHistoryChart from "@/components/RatingHistoryChart";
import RatingSummary from "@/components/RatingSummary";
import RepoMeta from "@/components/RepoMeta";
import RunList from "@/components/RunList";
import UsageHistoryChart from "@/components/UsageHistoryChart";
import { checklistVersionLabel } from "@/lib/criteria";
import { repositoryRunHref, type RepositoryRunResult } from "@/lib/repositoryRun";
import type { UsageStatus } from "@/lib/apiClient";
import { IS_STATIC_SITE, STATIC_SITE_LINKS } from "@/lib/dataSource/mode";
import type { RepositoryExtras } from "@/lib/dataSource";

interface RepositoryRunPageProps {
  owner: string;
  repo: string;
  result: RepositoryRunResult;
  /** Shown on the repository page: the stored usage and SLAs behind the Maintained level */
  maintained?: RepositoryMaintained;
  /** Shown on the repository page: the Common Ground status and the basisset */
  lifecycle?: RepositoryLifecycle;
  /** Shown on the repository page: functionalities, standards and the compare control */
  landscape?: ComponentLandscape;
}

export interface RepositoryMaintained {
  usage: UsageStatus | null;
  minUsers: number;
  /** Today as YYYY-MM-DD, the day an SLA must still be valid on */
  today: string;
  /** Slugs of the organisation pages by organisation key */
  organisationSlugs?: Record<string, string>;
}

const SECTION_CLASS = "bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4";

/** On the static site a component is followed by being on the component list, not with a control. */
function StaticFollowSection({ extras }: { extras: RepositoryExtras | null }) {
  return (
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
  );
}

/**
 * A repository with one of its runs in full: the repository page shows the
 * latest run, a run page the requested one. Both list every run and graph
 * the overall rating over time.
 */
export default function RepositoryRunPage({ owner, repo, result, maintained, lifecycle, landscape }: RepositoryRunPageProps) {
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
          href={result.kind === "missing-repository" ? "/components" : repositoryRunHref(owner, repo)}
          className="inline-flex min-h-[44px] items-center lg:min-h-0 text-cg-lightblue hover:underline text-sm"
        >
          {result.kind === "missing-repository" ? "← Back to components" : "← See the latest run"}
        </Link>
      </div>
    );
  }

  const { repository, repoMeta, runs, selected, latestId, latest, drops, extras } = result.run;
  const publiccode = selected?.results.find((item) => item.publiccode)?.publiccode;
  const analysisHref = (analysisId: string) => repositoryRunHref(repository.owner, repository.name, analysisId);
  const latestHref = repositoryRunHref(repository.owner, repository.name);
  const isOlder = selected !== null && selected.id !== latestId;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <Link href="/components" className="text-cg-lightblue hover:underline">
          Components
        </Link>{" "}
        / {repository.owner}/{repository.name}
      </nav>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-cg-blue">Component rating</h2>
        <div className="flex flex-wrap items-center gap-x-3 text-sm">
          <Link href="/components" className="inline-flex min-h-[44px] items-center lg:min-h-0 text-cg-lightblue hover:underline">
            Search another component
          </Link>
          <Link href={IS_STATIC_SITE ? "/add-component" : "/about#check"} className="inline-flex min-h-[44px] items-center lg:min-h-0 text-cg-lightblue hover:underline">
            {IS_STATIC_SITE ? "Add a component" : "Run new check"}
          </Link>
        </div>
      </div>

      <RepoMeta owner={repository.owner} repo={repository.name} repoMeta={repoMeta} followed={repository.followed} />

      {lifecycle && <LifecycleSection repoId={repository.id} {...lifecycle} />}

      {maintained && (
        <>
          <MaintainedSection
            repoId={repository.id}
            endorsement={latest.endorsement ?? { passed: false, reasons: ["Not scanned yet"] }}
            developmentStatus={latest.developmentStatus}
            initialUsage={maintained.usage}
            minUsers={maintained.minUsers}
            today={maintained.today}
            organisationSlugs={maintained.organisationSlugs}
            readOnly={IS_STATIC_SITE}
          />
          <section className={SECTION_CLASS}>
            <h3 className="text-lg font-semibold text-gray-800">Users over time</h3>
            <UsageHistoryChart analyses={runs} minUsers={maintained.minUsers} />
          </section>
        </>
      )}

      {extras && <ProvidersSection providers={extras.providers} listUrl={STATIC_SITE_LINKS.componentList} />}

      {landscape && <FunctionalitiesSection landscape={landscape} />}

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
        <section aria-labelledby="run-summary-heading" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          <h3 id="run-summary-heading" className="text-lg font-semibold text-gray-800">
            {isOlder ? "Older run" : "Latest run"}
          </h3>
          <p className="text-xs text-gray-500">
            Checked at {new Date(selected.checkedAt).toLocaleString("nl-NL")}
            {selected.scannedRef ? " · " : null}
            <ScannedRef scannedRef={selected.scannedRef} kind={selected.scannedRefKind} commit={selected.scannedCommit} />
          </p>
          <p className="text-xs text-gray-500">{checklistVersionLabel(selected.checklistVersion)}</p>
          <ScanModeLine
            scanMode={selected.scanMode}
            scanDurationSeconds={selected.scanDurationSeconds}
            results={selected.results}
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <RatingSummary rating={selected.rating} endorsement={selected.endorsement} score={selected.score} />
            <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50">
              Version: {selected.version ?? repoMeta.version ?? "unknown"}
            </span>
          </div>
        </section>
      )}

      {publiccode && <PublicCodeSection data={publiccode} />}

      {selected && selected.results.length > 0 && (
        <IssueBlocks results={selected.results} rating={selected.rating} endorsement={selected.endorsement} />
      )}

      {drops.length > 0 && <DropsCard drops={drops} />}

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

      {IS_STATIC_SITE ? (
        <StaticFollowSection extras={extras} />
      ) : (
        <FollowControl
          repoId={repository.id}
          initialFollowed={repository.followed}
          initialCheckIntervalHours={repository.checkIntervalHours}
          initialScanRef={repository.scanRef}
          initialNextCheckAt={repository.nextCheckAt}
        />
      )}

      {selected && <CriteriaResults results={selected.results} categoryRatings={selected.categoryRatings} />}
    </div>
  );
}
