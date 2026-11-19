import { codeUnchangedLine, codeUnchangedSince, scanDurationText } from "@/lib/scanModeText";
import type { CheckResult } from "@/lib/types";

interface ScanModeLineProps {
  scanMode?: string | null;
  scanDurationSeconds?: number | null;
  results: Pick<CheckResult, "reusedFrom">[];
}

/** Whether the run reused the code checks of an earlier scan, and how long it took. */
export default function ScanModeLine({ scanMode, scanDurationSeconds, results }: ScanModeLineProps) {
  const since = scanMode === "partial" ? codeUnchangedSince(results) : null;
  const duration = typeof scanDurationSeconds === "number" ? scanDurationText(scanDurationSeconds) : null;
  const mode = since ? `${codeUnchangedLine(since)}.` : scanMode === "full" ? "Full scan: every check ran." : null;
  const parts = [mode, duration ? `${duration}.` : null].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="text-xs text-gray-500">{parts.join(" ")}</p>;
}
