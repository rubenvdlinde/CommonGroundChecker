"use client";

import { formatStars, scoreToStars } from "@/lib/stars";

interface ScoreBadgeProps {
  score: number;
}

function getScoreColor(score: number): { ring: string; fill: string; label: string } {
  if (score >= 80)
    return { ring: "stroke-green-500", fill: "text-green-600", label: "Compliant" };
  if (score >= 50)
    return { ring: "stroke-yellow-400", fill: "text-yellow-600", label: "Partial" };
  return { ring: "stroke-red-400", fill: "text-red-600", label: "Non-compliant" };
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  const { ring, fill, label } = getScoreColor(score);
  const stars = scoreToStars(score);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 96 96"
          aria-hidden="true"
        >
          {/* Background ring */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress ring */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            className={ring}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-extrabold ${fill}`}>{score}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>
      <span className={`text-sm font-bold ${fill}`}>{label}</span>
      <span className="text-lg leading-none text-amber-500" aria-label={`${stars} of 5 stars`}>
        {formatStars(stars)}
      </span>
    </div>
  );
}
