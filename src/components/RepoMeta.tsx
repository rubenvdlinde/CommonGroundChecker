"use client";

import { Star, GitFork, Code, Tag } from "lucide-react";
import type { CheckReport } from "@/lib/types";
import RepoLogo from "@/components/RepoLogo";

interface RepoMetaProps {
  owner: string;
  repo: string;
  repoMeta: CheckReport["repoMeta"];
  /** Shows the Followed badge when the repository is rescanned on a schedule */
  followed?: boolean;
}

export default function RepoMeta({ owner, repo, repoMeta, followed = false }: RepoMetaProps) {
  const displayName = repoMeta.displayName ?? `${owner}/${repo}`;
  const summary = repoMeta.shortDescription ?? repoMeta.description;
  const maintainers = repoMeta.maintainers ?? [];
  const versionEvidence = repoMeta.versionEvidence ?? {
    source: "none",
    detail: "No version evidence available",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-3">
          <RepoLogo logoUrl={repoMeta.logoUrl ?? null} name={displayName} size={48} />
          <div>
            {repoMeta.displayName && (
              <p className="text-lg font-bold text-gray-800">{repoMeta.displayName}</p>
            )}
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${repoMeta.displayName ? "text-sm" : "text-lg font-bold"} text-cg-lightblue hover:underline`}
            >
              {owner}/{repo}
            </a>
            {summary && <p className="text-sm text-gray-600 mt-0.5">{summary}</p>}
          </div>
        </div>
        {repoMeta.license && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium shrink-0">
            {repoMeta.license}
          </span>
        )}
        {repoMeta.developmentStatus && (
          <span className="text-xs bg-green-50 text-green-800 border border-green-200 rounded-full px-3 py-1 font-medium shrink-0">
            Status: {repoMeta.developmentStatus}
          </span>
        )}
        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 font-medium shrink-0">
          Version {repoMeta.version ?? "not found"}
        </span>
        {followed && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full border border-green-300 text-green-800 bg-green-50 shrink-0">
            Followed
          </span>
        )}
      </div>

      {(repoMeta.maintenanceType || maintainers.length > 0) && (
        <p className="text-xs text-gray-500">
          Maintenance: {repoMeta.maintenanceType ?? "unknown"}
          {maintainers.length > 0 && ` by ${maintainers.join(", ")}`}
        </p>
      )}

      <p className="text-xs text-gray-500">
        Version evidence: {versionEvidence.source} — {versionEvidence.detail}
      </p>

      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        {repoMeta.language && (
          <span className="flex items-center gap-1">
            <Code className="w-4 h-4" />
            {repoMeta.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-400" />
          {repoMeta.stars.toLocaleString()} stars
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="w-4 h-4" />
          {repoMeta.forks.toLocaleString()} forks
        </span>
      </div>

      {repoMeta.topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {repoMeta.topics.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-600"
            >
              <Tag className="w-3 h-3" />
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
