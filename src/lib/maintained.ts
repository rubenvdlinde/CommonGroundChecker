import type { CheckResult, Endorsement } from "./types";

/** "1 organisation" or "2 organisations". */
export function organisationsLabel(count: number): string {
  return `${count} ${count === 1 ? "organisation" : "organisations"}`;
}

/** The organisations under `usedBy` in the scanned publiccode.yml; empty when it has none. */
export function declaredUsersOf(results: CheckResult[]): string[] {
  return results.find((result) => result.publiccode)?.publiccode?.usedBy ?? [];
}

/** `developmentStatus` of the scanned publiccode.yml in stored results, or null when the file or the field is missing. */
export function developmentStatusOf(results: unknown): string | null {
  if (!Array.isArray(results)) return null;
  for (const result of results as Array<{ publiccode?: { developmentStatus?: unknown } } | null>) {
    const status = result?.publiccode?.developmentStatus;
    if (result?.publiccode) return typeof status === "string" && status.trim() ? status.trim() : null;
  }
  return null;
}

export interface MaintainedSla {
  party: string;
  maintainer: string;
  startsOn: string;
  /** Last day the SLA applies, as YYYY-MM-DD */
  until: string;
  link?: string | null;
}

/** An SLA is valid up to and including its `until` day, the same rule as a maintenance contract in publiccode.yml. */
export function isSlaValid(sla: Pick<MaintainedSla, "until">, today: string): boolean {
  return sla.until >= today;
}

export interface MaintainedLevelResult {
  /** Maintained: suitable for Common Ground and a valid SLA */
  maintained: boolean;
  /** Why the component is not Maintained, in the order of the conditions */
  reasons: string[];
  /** The valid SLA that ends last, or null */
  sla: MaintainedSla | null;
}

export interface MaintainedInput {
  endorsement: Endorsement;
  slas: MaintainedSla[];
  /** Today as YYYY-MM-DD */
  today: string;
}

/**
 * Maintained is the level above Suitable for Common Ground: the component is
 * suitable, which already asks `developmentStatus: stable` and enough
 * organisations under `usedBy` in publiccode.yml, and an SLA is valid. Usage
 * counts only in the verdict, never in a rating.
 */
export function computeMaintained(input: MaintainedInput): MaintainedLevelResult {
  const reasons: string[] = [];
  if (!input.endorsement.passed) reasons.push("Not yet suitable for Common Ground");

  const byEnd = [...input.slas].sort((a, b) => b.until.localeCompare(a.until));
  const sla = byEnd.find((candidate) => isSlaValid(candidate, input.today)) ?? null;
  if (byEnd.length === 0) reasons.push("No SLA");
  else if (!sla) reasons.push(`SLA expired on ${byEnd[0].until}`);

  return { maintained: reasons.length === 0, reasons, sla };
}
