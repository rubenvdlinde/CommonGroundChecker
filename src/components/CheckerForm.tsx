"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getRepositories, getRepoHistory, RepoSummary } from "@/lib/apiClient";
import { EXAMPLE_REPOS, STARTER_REPOS, type ExampleRepository } from "@/lib/exampleRepos";

interface CheckerFormProps {
  onSubmit: (
    url: string,
    helmChartLocations: string[],
    documentationLocations: string[],
    dockerLocations: string[],
    apiSpecificationLocations: string[],
    isRegister: boolean,
    ref: string
  ) => void;
  loading: boolean;
}

type RecentRepository = RepoSummary;

type StoredCheckResult = {
  id?: string;
  evidence?: string[];
};

function normalizeLocations(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => value.trim()).filter(Boolean);
}

function parseLocationsInput(value: string): string[] {
  return value
    .split(/\r?\n|,+/)
    .map((location) => location.trim())
    .filter(Boolean);
}

function extractFromEvidenceByCheckId(
  results: StoredCheckResult[] | undefined,
  checkId: string
): string[] {
  if (!Array.isArray(results)) return [];
  const hit = results.find((item) => item.id === checkId);
  const evidence = Array.isArray(hit?.evidence) ? hit.evidence : [];
  return evidence.map((value) => value.trim()).filter(Boolean);
}

function parseHelmLocationsFromEvidence(results: StoredCheckResult[] | undefined): string[] {
  const helmEvidence = extractFromEvidenceByCheckId(results, "helmchart");
  const providedLine = helmEvidence.find((line) =>
    line.toLowerCase().startsWith("provided helm locations:")
  );

  if (providedLine) {
    return providedLine
      .split(":")
      .slice(1)
      .join(":")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const externalHelm = helmEvidence.filter((line) => line.startsWith("http"));
  return externalHelm;
}

function parseDocumentationLocationsFromEvidence(
  results: StoredCheckResult[] | undefined
): string[] {
  const docEvidence = extractFromEvidenceByCheckId(results, "documentation");
  return docEvidence.filter((value) => /^https?:\/\//i.test(value));
}

function parseApiSpecificationLocationsFromEvidence(
  results: StoredCheckResult[] | undefined
): string[] {
  const apiEvidence = extractFromEvidenceByCheckId(results, "openapi");

  return apiEvidence
    .map((value) => {
      const prefix = "API specification was auto-discovered by the checker:";
      if (value.startsWith(prefix)) {
        return value.slice(prefix.length).trim();
      }
      return value;
    })
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      if (/^https?:\/\//i.test(value)) return true;
      return !value.includes("://") && !value.includes(" ");
    });
}

async function fetchLatestLocationsFromHistory(
  owner: string,
  repo: string
): Promise<{
  helmChartLocations: string[];
  dockerLocations: string[];
  apiSpecificationLocations: string[];
  documentationLocations: string[];
}> {
  try {
    const data = await getRepoHistory(owner, repo, 1);
    const latestResults = data.analyses?.[0]?.results;

    return {
      helmChartLocations: parseHelmLocationsFromEvidence(latestResults),
      dockerLocations: extractFromEvidenceByCheckId(latestResults, "dockerimage"),
      apiSpecificationLocations: parseApiSpecificationLocationsFromEvidence(
        latestResults
      ),
      documentationLocations: parseDocumentationLocationsFromEvidence(latestResults),
    };
  } catch {
    return {
      helmChartLocations: [],
      dockerLocations: [],
      apiSpecificationLocations: [],
      documentationLocations: [],
    };
  }
}

export default function CheckerForm({ onSubmit, loading }: CheckerFormProps) {
  console.log("CheckerForm rendered", { loading });
  const [value, setValue] = useState("");
  const [recentRepositories, setRecentRepositories] = useState<RecentRepository[]>([]);
  const [helmSomewhereElse, setHelmSomewhereElse] = useState(false);
  const [helmChartUrl, setHelmChartUrl] = useState("");
  const [documentationSomewhereElse, setDocumentationSomewhereElse] =
    useState(false);
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [dockerSomewhereElse, setDockerSomewhereElse] = useState(false);
  const [dockerUrl, setDockerUrl] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [scanRef, setScanRef] = useState("");
  const [apiSpecificationSomewhereElse, setApiSpecificationSomewhereElse] =
    useState(false);
  const [apiSpecificationLocationsInput, setApiSpecificationLocationsInput] =
    useState("");

  function resetOptionalInputs() {
    setHelmSomewhereElse(false);
    setHelmChartUrl("");
    setDocumentationSomewhereElse(false);
    setDocumentationUrl("");
    setDockerSomewhereElse(false);
    setDockerUrl("");
    setIsRegister(false);
    setApiSpecificationSomewhereElse(false);
    setApiSpecificationLocationsInput("");
    setScanRef("");
  }

  async function applyRepositoryPrefill(repository: RecentRepository) {
    let helmChartLocations = normalizeLocations(repository.helmChartLocations);
    let documentationLocations = normalizeLocations(repository.documentationLocations);
    let dockerLocations = normalizeLocations(repository.dockerLocations);
    let apiSpecificationLocations = normalizeLocations(repository.apiSpecificationLocations);

    const needsFallback =
      helmChartLocations.length === 0 ||
      documentationLocations.length === 0 ||
      dockerLocations.length === 0 ||
      apiSpecificationLocations.length === 0;

    if (needsFallback) {
      const fallback = await fetchLatestLocationsFromHistory(
        repository.owner,
        repository.name
      );

      if (helmChartLocations.length === 0) {
        helmChartLocations = fallback.helmChartLocations;
      }
      if (documentationLocations.length === 0) {
        documentationLocations = fallback.documentationLocations;
      }
      if (dockerLocations.length === 0) {
        dockerLocations = fallback.dockerLocations;
      }
      if (apiSpecificationLocations.length === 0) {
        apiSpecificationLocations = fallback.apiSpecificationLocations;
      }
    }

    const helmLocation = helmChartLocations[0] ?? "";
    const documentationLocation = documentationLocations[0] ?? "";
    const dockerLocation = dockerLocations[0] ?? "";
    const apiSpecificationLocation = apiSpecificationLocations[0] ?? "";
    const apiSpecificationLocationsText = apiSpecificationLocations.join("\n");

    setValue(repository.repoUrl);
    setScanRef(repository.scanRef ?? "");

    setHelmSomewhereElse(Boolean(helmLocation));
    setHelmChartUrl(helmLocation);

    setDocumentationSomewhereElse(Boolean(documentationLocation));
    setDocumentationUrl(documentationLocation);

    setDockerSomewhereElse(Boolean(dockerLocation));
    setDockerUrl(dockerLocation);

    const hasApiSpecificationLocation = Boolean(apiSpecificationLocation);
    setIsRegister(hasApiSpecificationLocation);
    setApiSpecificationSomewhereElse(hasApiSpecificationLocation);
    setApiSpecificationLocationsInput(apiSpecificationLocationsText);
  }

  async function handleExampleSelect(url: string) {
    const fromHistory = recentRepositories.find(
      (repository) => repository.repoUrl === url
    );

    if (fromHistory) {
      await applyRepositoryPrefill(fromHistory);
      return;
    }

    resetOptionalInputs();
    setValue(url);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRecentRepositories() {
      try {
        const repositories = await getRepositories(8);
        if (cancelled) return;

        setRecentRepositories(repositories);
      } catch {
        // Ignore and keep the static examples only.
      }
    }

    void loadRecentRepositories();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("CheckerForm submit", {
      value,
      helmSomewhereElse,
      helmChartUrl,
      documentationSomewhereElse,
      documentationUrl,
      dockerSomewhereElse,
      dockerUrl,
      isRegister,
      apiSpecificationSomewhereElse,
      apiSpecificationLocationsInput,
    });
    if (!value.trim()) return;
    if (helmSomewhereElse && !helmChartUrl.trim()) return;
    if (documentationSomewhereElse && !documentationUrl.trim()) return;
    if (dockerSomewhereElse && !dockerUrl.trim()) return;
    if (isRegister && apiSpecificationSomewhereElse && !apiSpecificationLocationsInput.trim()) return;

    const parsedHelmLocations = helmSomewhereElse && helmChartUrl.trim()
      ? [helmChartUrl.trim()]
      : [];
    const parsedDocumentationLocations =
      documentationSomewhereElse && documentationUrl.trim()
        ? [documentationUrl.trim()]
        : [];
    const parsedDockerLocations = dockerSomewhereElse && dockerUrl.trim()
      ? [dockerUrl.trim()]
      : [];
    const parsedApiSpecificationLocations =
      isRegister && apiSpecificationSomewhereElse && apiSpecificationLocationsInput.trim()
        ? parseLocationsInput(apiSpecificationLocationsInput)
        : [];

    onSubmit(
      value.trim(),
      parsedHelmLocations,
      parsedDocumentationLocations,
      parsedDockerLocations,
      parsedApiSpecificationLocations,
      isRegister,
      scanRef.trim()
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://github.com/organisation/repository or https://gitlab.com/organisation/repository"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cg-lightblue focus:border-transparent disabled:opacity-60"
              disabled={loading}
              required
            />
          </div>
          <button
            type="submit"
            disabled={
              loading ||
              !value.trim() ||
              (helmSomewhereElse && !helmChartUrl.trim()) ||
              (documentationSomewhereElse && !documentationUrl.trim()) ||
              (dockerSomewhereElse && !dockerUrl.trim()) ||
              (isRegister && apiSpecificationSomewhereElse && !apiSpecificationLocationsInput.trim())
            }
            className="px-6 py-3 bg-cg-blue text-white font-semibold rounded-lg hover:bg-cg-lightblue transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            {loading ? (
              <>
                <span className="spinner" />
                Checking…
              </>
            ) : (
              "Analyze component"
            )}
          </button>
        </div>

        <div>
          <label htmlFor="scan-ref" className="block text-xs text-gray-500 mb-1">
            Branch or tag to scan (optional; empty scans the released version: the tag of the publiccode.yml softwareVersion, else the latest release; default-branch scans the default branch)
          </label>
          <input
            id="scan-ref"
            type="text"
            value={scanRef}
            onChange={(e) => setScanRef(e.target.value)}
            placeholder="development, v1.2.0, latest-release or default-branch"
            className="min-h-[44px] lg:min-h-0 w-full sm:w-80 px-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cg-lightblue focus:border-transparent disabled:opacity-60"
            disabled={loading}
          />
        </div>

        <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isRegister}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsRegister(checked);
              if (!checked) {
                setApiSpecificationSomewhereElse(false);
                setApiSpecificationLocationsInput("");
              }
            }}
            disabled={loading}
            className="h-4 w-4 rounded border-gray-300 text-cg-lightblue focus:ring-cg-lightblue"
          />
          Component is a register
        </label>
        <p className="text-xs text-gray-500">
          When selected, the checker will require an OpenAPI/Swagger specification and try to discover the API definition.
        </p>

        {isRegister && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={apiSpecificationSomewhereElse}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setApiSpecificationSomewhereElse(checked);
                  if (!checked) setApiSpecificationLocationsInput("");
                }}
                disabled={loading}
                className="h-4 w-4 rounded border-gray-300 text-cg-lightblue focus:ring-cg-lightblue"
              />
              API specification is somewhere else
            </label>

            {apiSpecificationSomewhereElse && (
              <div>
                <label htmlFor="api-specification-locations" className="block text-xs text-gray-500 mb-1">
                  One or more API specification URLs/paths, one per line
                </label>
                <textarea
                  id="api-specification-locations"
                  value={apiSpecificationLocationsInput}
                  onChange={(e) => setApiSpecificationLocationsInput(e.target.value)}
                  placeholder="https://example.com/openapi.yaml\napi/openapi.yaml"
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cg-lightblue focus:border-transparent disabled:opacity-60"
                  disabled={loading}
                  required={isRegister && apiSpecificationSomewhereElse}
                />
              </div>
            )}
          </>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={helmSomewhereElse}
            onChange={(e) => {
              const checked = e.target.checked;
              setHelmSomewhereElse(checked);
              if (!checked) setHelmChartUrl("");
            }}
            disabled={loading}
            className="h-4 w-4 rounded border-gray-300 text-cg-lightblue focus:ring-cg-lightblue"
          />
          Helm chart is somewhere else
        </label>

        {helmSomewhereElse && (
          <div>
            <label htmlFor="helm-chart-url" className="block text-xs text-gray-500 mb-1">
              URL to the Helm chart
            </label>
            <input
              id="helm-chart-url"
              type="url"
              value={helmChartUrl}
              onChange={(e) => setHelmChartUrl(e.target.value)}
              placeholder="https://github.com/org/charts/tree/main/charts/mychart"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cg-lightblue focus:border-transparent disabled:opacity-60"
              disabled={loading}
              required={helmSomewhereElse}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={documentationSomewhereElse}
            onChange={(e) => {
              const checked = e.target.checked;
              setDocumentationSomewhereElse(checked);
              if (!checked) setDocumentationUrl("");
            }}
            disabled={loading}
            className="h-4 w-4 rounded border-gray-300 text-cg-lightblue focus:ring-cg-lightblue"
          />
          Documentation is on a separate site
        </label>

        {documentationSomewhereElse && (
          <div>
            <label
              htmlFor="documentation-url"
              className="block text-xs text-gray-500 mb-1"
            >
              URL to documentation site
            </label>
            <input
              id="documentation-url"
              type="url"
              value={documentationUrl}
              onChange={(e) => setDocumentationUrl(e.target.value)}
              placeholder="https://docs.example.com"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cg-lightblue focus:border-transparent disabled:opacity-60"
              disabled={loading}
              required={documentationSomewhereElse}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={dockerSomewhereElse}
            onChange={(e) => {
              const checked = e.target.checked;
              setDockerSomewhereElse(checked);
              if (!checked) setDockerUrl("");
            }}
            disabled={loading}
            className="h-4 w-4 rounded border-gray-300 text-cg-lightblue focus:ring-cg-lightblue"
          />
          Docker image available
        </label>

        {dockerSomewhereElse && (
          <div>
            <label htmlFor="docker-url" className="block text-xs text-gray-500 mb-1">
              URL to Docker image
            </label>
            <input
              id="docker-url"
              type="url"
              value={dockerUrl}
              onChange={(e) => setDockerUrl(e.target.value)}
              placeholder="https://ghcr.io/your-org/your-image"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cg-lightblue focus:border-transparent disabled:opacity-60"
              disabled={loading}
              required={dockerSomewhereElse}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400">Try an example:</p>
        <div className="flex flex-wrap gap-2 items-center">
          {EXAMPLE_REPOS.map((repo) => (
            <button
              key={repo.repoUrl}
              type="button"
              onClick={() => {
                void handleExampleSelect(repo.repoUrl);
              }}
              disabled={loading}
              className="text-xs text-cg-lightblue hover:underline disabled:opacity-50"
            >
              {repo.label}
            </button>
          ))}
        </div>
      </div>

      </form>

      {(recentRepositories.length > 0 || STARTER_REPOS.length > 0) && (
        <aside className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {recentRepositories.length > 0
                  ? "Recently analyzed"
                  : "Starter repositories"}
              </p>
              <p className="text-xs text-gray-500">
                {recentRepositories.length > 0
                  ? "Pick a repository from history to prefill the checker."
                  : "Try one of these example repositories to get started quickly."}
              </p>
            </div>
            {recentRepositories.length > 0 ? (
              <Link
                href="/history"
                className="text-xs font-medium text-cg-lightblue hover:underline"
              >
                View history
              </Link>
            ) : null}
          </div>

          <div className="space-y-2">
            {recentRepositories.length > 0
              ? recentRepositories.map((repository) => (
                  <button
                    key={repository.id}
                    type="button"
                    onClick={() => {
                      void applyRepositoryPrefill(repository);
                    }}
                    disabled={loading}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left transition-colors hover:border-cg-lightblue hover:bg-cg-lightblue/5 disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {repository.owner}/{repository.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{repository.repoUrl}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      <span>{repository.analysisCount} analys{repository.analysisCount === 1 ? "is" : "es"}</span>
                      {repository.latestAnalysis && (
                        <span>Latest score: {repository.latestAnalysis.score}</span>
                      )}
                    </div>
                  </button>
                ))
              : STARTER_REPOS.map((repo) => (
                  <button
                    key={repo.repoUrl}
                    type="button"
                    onClick={() => {
                      void handleExampleSelect(repo.repoUrl);
                    }}
                    disabled={loading}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left transition-colors hover:border-cg-lightblue hover:bg-cg-lightblue/5 disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {repo.label}
                    </p>
                    <p className="truncate text-xs text-gray-500">{repo.repoUrl}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      <span>Example repository</span>
                    </div>
                  </button>
                ))}
          </div>
        </aside>
      )}
    </div>
  );
}
