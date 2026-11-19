import Link from "next/link";
import { getRepositories, type RepoSummary } from "@/lib/apiClient";
import {
  BASISSET_REPOSITORY_URL,
  basissetOverview,
  loadBasisset,
  type BasissetOverviewRow,
  type CheckedRepository,
  type VersionComparison,
} from "@/lib/basisset";
import { repositoryRunHref } from "@/lib/repositoryRun";

export const dynamic = "force-dynamic";

const COMPARISON_LABELS: Record<VersionComparison, string> = {
  equal: "the same version",
  newer: "newer",
  older: "older",
  unknown: "not comparable",
};

function checkedRepositories(repositories: RepoSummary[]): CheckedRepository[] {
  return repositories.map((repository) => {
    const version = (repository.latestAnalysis as { version?: unknown } | null)?.version;
    return {
      owner: repository.owner,
      name: repository.name,
      repoUrl: repository.repoUrl,
      version: typeof version === "string" && version.trim() ? version.trim() : null,
    };
  });
}

function RepositoryLink({ repository }: { repository: CheckedRepository }) {
  return (
    <Link
      href={repositoryRunHref(repository.owner, repository.name)}
      className="inline-flex items-center min-h-[44px] font-semibold text-cg-blue hover:underline break-all"
    >
      {repository.owner}/{repository.name}
    </Link>
  );
}

function Row({ row }: { row: BasissetOverviewRow }) {
  const { entry, matches, otherAddress } = row;
  return (
    <li className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-800">{entry.name}</span>
        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-300 text-sky-900 bg-sky-50">
          {entry.basisset ? "In basisset" : "Next to basisset"}
        </span>
        {entry.status && <span className="text-xs text-gray-600">Status {entry.status}</span>}
        <span className="text-xs text-purple-700">Version {entry.version ?? "not given"}</span>
      </div>
      {entry.description && <p className="text-sm text-gray-600">{entry.description}</p>}
      <p className="text-xs text-gray-500 break-all">
        {entry.repo.length > 0 ? `Address: ${entry.repo.join(", ")}` : "No repository address in the list."}
      </p>
      {matches.length > 0 ? (
        <ul aria-label={`In the checker for ${entry.name}`} className="text-sm text-gray-700">
          {matches.map((match) => (
            <li key={match.repoUrl} className="flex flex-wrap items-center gap-x-2">
              <span>In the checker:</span>
              <RepositoryLink repository={match} />
              <span>
                {match.version
                  ? `scanned version ${match.version}, ${COMPARISON_LABELS[match.comparison]}${match.comparison === "newer" || match.comparison === "older" ? " than the basisset" : ""}`
                  : "no scanned version"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Not in the checker at this address.</p>
      )}
      {otherAddress.length > 0 && (
        <ul aria-label={`At another address for ${entry.name}`} className="text-sm text-amber-900">
          {otherAddress.map((repository) => (
            <li key={repository.repoUrl} className="flex flex-wrap items-center gap-x-2">
              <span>Same repository name in the checker at another address:</span>
              <RepositoryLink repository={repository} />
              <span>The address in the list may be out of date.</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Every entry of the Common Ground basisset, with the component in the checker that matches it. */
export default async function BasissetPage() {
  const basissetLoad = loadBasisset();
  let repositories: RepoSummary[] = [];
  let repositoriesError = false;
  try {
    repositories = await getRepositories(50);
  } catch {
    repositoriesError = true;
  }
  const basisset = await basissetLoad;
  const rows = basisset ? basissetOverview(basisset, checkedRepositories(repositories)) : [];
  const inBasisset = rows.filter((row) => row.entry.basisset).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Common Ground basisset</h2>
        <p className="text-gray-700">
          The basisset is the list of components VNG names for Common Ground. The list also names components next to
          the basisset. The checker matches each entry to a component it knows by the repository address.
        </p>
        <p className="text-sm text-gray-600">
          Shown for information. The basisset is not part of a rating, the verdict or the status.{" "}
          <a href={BASISSET_REPOSITORY_URL} className="inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline">
            The list on code.overheid.nl
          </a>
        </p>
        {basisset && (
          <p role="status" className="text-sm text-gray-600">
            Version {basisset.version ?? "unknown"} of the list: {rows.length} entries, {inBasisset} in the basisset and{" "}
            {rows.length - inBasisset} next to it.
          </p>
        )}
        {repositoriesError && (
          <p className="text-sm text-red-700">The components in the checker could not be loaded, so nothing is matched.</p>
        )}
      </section>
      {basisset ? (
        <ul aria-label="Basisset entries" className="space-y-3">
          {rows.map((row, index) => (
            <Row key={`${row.entry.name}-${index}`} row={row} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          The basisset could not be read from code.overheid.nl just now.
        </p>
      )}
    </div>
  );
}
