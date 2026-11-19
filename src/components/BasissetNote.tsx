import Link from "next/link";
import { describeBasissetEntry, describeVersionComparison, type BasissetMatch } from "@/lib/basisset";

interface BasissetNoteProps {
  match: BasissetMatch;
  /** The scanned version of the latest analysis, or null */
  scannedVersion: string | null;
}

/** What the Common Ground basisset says about a component. Information only: it counts in no rating, verdict or status. */
export default function BasissetNote({ match, scannedVersion }: BasissetNoteProps) {
  if (!match.available) {
    return <p className="text-sm text-gray-600">The Common Ground basisset could not be read just now.</p>;
  }
  return (
    <div className="space-y-2 text-sm text-gray-700">
      {match.entries.length === 0 ? (
        <p>Not in the Common Ground basisset.</p>
      ) : (
        <ul aria-label="Basisset entries" className="space-y-1">
          {match.entries.map((entry) => {
            const comparison = describeVersionComparison(scannedVersion, entry);
            return (
              <li key={entry.name}>
                {describeBasissetEntry(entry)}.{comparison && ` ${comparison}.`}
              </li>
            );
          })}
        </ul>
      )}
      {match.otherAddress.length > 0 && (
        <ul aria-label="Basisset entries at another address" className="space-y-1 text-amber-900 break-words">
          {match.otherAddress.map((entry) => (
            <li key={`${entry.name}-${entry.repo}`}>
              The basisset lists {entry.name} with the same repository name at another address: {entry.repo}.
              The address in the list may be out of date.
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500">
        Shown for information. The basisset is not part of the rating, the verdict or the status.{" "}
        <Link href="/basisset" className="inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline">
          See the whole basisset
        </Link>
      </p>
    </div>
  );
}
