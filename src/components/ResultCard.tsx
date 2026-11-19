"use client";

import type { CheckStatus, ConfidenceLevel, RequirementLevel, ReusedFrom, StarRating } from "@/lib/types";
import { formatStars } from "@/lib/stars";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { criterionAnchorId, isInTransition, transitionNotice } from "@/lib/criteria";
import { reusedNote } from "@/lib/scanModeText";

interface ResultCardProps {
  id: string;
  title: string;
  description: string;
  requirementLevel?: RequirementLevel;
  confidence?: ConfidenceLevel;
  status: CheckStatus;
  message: string;
  evidence?: string[];
  referenceUrl?: string;
  starRating?: StarRating;
  /** The date a mandatory criterion in its transition period becomes mandatory */
  mandatoryFrom?: string;
  /** Set when the result was copied from an earlier scan of the same commit */
  reusedFrom?: ReusedFrom;
}

const REQUIREMENT_CONFIG: Record<
  RequirementLevel,
  { label: string; className: string }
> = {
  mandatory: {
    label: "Mandatory",
    className: "bg-red-50 text-red-700 border-red-300",
  },
  recommended: {
    label: "Recommended",
    className: "bg-amber-50 text-amber-700 border-amber-300",
  },
  informative: {
    label: "Informative",
    className: "bg-blue-50 text-blue-700 border-blue-300",
  },
};

const STATUS_CONFIG: Record<
  CheckStatus,
  { icon: React.ElementType; bg: string; border: string; text: string; label: string }
> = {
  pass: {
    icon: CheckCircle,
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-700",
    label: "Pass",
  },
  fail: {
    icon: XCircle,
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    label: "Fail",
  },
  warn: {
    icon: AlertTriangle,
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
    label: "Warning",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    label: "Info",
  },
};

export default function ResultCard({
  id,
  title,
  description,
  requirementLevel,
  confidence,
  status,
  message,
  evidence,
  referenceUrl,
  starRating,
  mandatoryFrom,
  reusedFrom,
}: ResultCardProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const anchorId = criterionAnchorId(id);

  useEffect(() => {
    const openWhenTargeted = () => {
      if (window.location.hash !== `#${anchorId}`) return;
      setOpen(true);
      buttonRef.current?.focus();
    };
    openWhenTargeted();
    window.addEventListener("hashchange", openWhenTargeted);
    return () => window.removeEventListener("hashchange", openWhenTargeted);
  }, [anchorId]);
  const transition = isInTransition({ requirementLevel, mandatoryFrom }) ? mandatoryFrom : undefined;
  // A mandatory criterion that fails in its transition period shows as a warning.
  const shownStatus = transition && status === "fail" ? "warn" : status;
  const { icon: Icon, bg, border, text, label } = STATUS_CONFIG[shownStatus];
  const req = transition
    ? { label: transitionNotice(transition), className: REQUIREMENT_CONFIG.recommended.className }
    : REQUIREMENT_CONFIG[requirementLevel ?? "recommended"];

  return (
    <div id={anchorId} className={`rounded-xl border ${border} ${bg} overflow-hidden scroll-mt-4`}>
      <button
        ref={buttonRef}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon className={`w-5 h-5 shrink-0 ${text}`} />
        <span className="flex-1 flex items-center gap-2">
          <span className="font-semibold text-gray-800">{title}</span>
          {description && (
            <span className="relative group/tooltip inline-flex items-center">
              <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-default" />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50
                           w-64 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg
                           opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150"
              >
                {description}
                <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900" />
              </span>
            </span>
          )}
        </span>
        {starRating && (
          <span className="text-sm leading-none text-amber-500" aria-label={`${starRating} of 5 stars`}>
            {formatStars(starRating)}
          </span>
        )}
        <span
          className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${text} border ${border}`}
        >
          {label}
        </span>
        <span
          className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${req.className}`}
        >
          {req.label}
        </span>
        {confidence && (
          <span className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50">
            {confidence} confidence
          </span>
        )}
        {reusedFrom && (
          <span
            className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 bg-white/70"
            title={reusedNote(reusedFrom)}
          >
            reused
          </span>
        )}
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-200 pt-3">
          <p className="text-sm text-gray-600 italic">{description}</p>
          <p className={`text-sm font-medium ${text}`}>{message}</p>
          {reusedFrom && <p className="text-xs text-gray-500">{reusedNote(reusedFrom)}</p>}

          {evidence && evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Evidence
              </p>
              <ul className="space-y-0.5">
                {evidence.map((e, index) => (
                  <li
                    key={`${e}-${index}`}
                    className="text-xs font-mono bg-white/60 rounded px-2 py-1 text-gray-700"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {referenceUrl && (
            <a
              href={referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cg-lightblue hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Reference / Standard
            </a>
          )}
        </div>
      )}
    </div>
  );
}
