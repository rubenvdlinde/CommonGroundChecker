"use client";

import { Star, GitFork, Code, Tag } from "lucide-react";
import type { CheckReport } from "@/lib/types";

interface RepoMetaProps {
  owner: string;
  repo: string;
  repoMeta: CheckReport["repoMeta"];
}

export default function RepoMeta({ owner, repo, repoMeta }: RepoMetaProps) {
  const versionEvidence = repoMeta.versionEvidence ?? {
    source: "none",
    detail: "No version evidence available",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target inline-flex items-center text-lg font-bold text-cg-lightblue hover:underline break-words"
          >
            {owner}/{repo}
          </a>
          {repoMeta.description && (
            <p className="text-sm text-gray-600 mt-0.5">{repoMeta.description}</p>
          )}
        </div>
        {repoMeta.license && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium shrink-0">
            {repoMeta.license}
          </span>
        )}
        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 font-medium shrink-0">
          Version {repoMeta.version ?? "not found"}
        </span>
      </div>

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
