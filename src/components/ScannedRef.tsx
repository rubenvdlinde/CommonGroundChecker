import { formatScanned, SCAN_REF_KINDS } from "@/lib/scanRef";

interface ScannedRefProps {
  scannedRef?: string | null;
  kind?: string | null;
  commit?: string | null;
  warning?: string | null;
}

/** "Scanned: development @ abc1234", plus the warning when the requested ref was not used. */
export default function ScannedRef({ scannedRef, kind, commit, warning }: ScannedRefProps) {
  if (!scannedRef) return null;
  const knownKind = SCAN_REF_KINDS.find((value) => value === kind) ?? null;

  return (
    <>
      <span>Scanned: {formatScanned(scannedRef, knownKind, commit)}</span>
      {warning ? (
        <span role="alert" className="block mt-1 text-yellow-700">
          {warning}
        </span>
      ) : null}
    </>
  );
}
