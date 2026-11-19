import type { CheckResult, Endorsement } from "./types";

/** The proposed minimum of users declared in publiccode.yml for Approved; `MIN_USERS` overrides it. */
export const DEFAULT_MIN_USERS = 2;

/** `MIN_USERS` as a whole number of at least 1, else the default. */
export function minUsers(value: string | undefined = process.env.MIN_USERS): number {
  const parsed = Number(value?.trim());
  return value?.trim() && Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_MIN_USERS;
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

export interface ApprovalSla {
  party: string;
  maintainer: string;
  startsOn: string;
  /** Last day the SLA applies, as YYYY-MM-DD */
  until: string;
  link?: string | null;
}

/** An SLA is valid up to and including its `until` day, the same rule as a maintenance contract in publiccode.yml. */
export function isSlaValid(sla: Pick<ApprovalSla, "until">, today: string): boolean {
  return sla.until >= today;
}

export interface Approval {
  /** Approved: suitable for Common Ground, stable, enough users declared in publiccode.yml and a valid SLA */
  approved: boolean;
  /** Why the component is not approved, in the order of the conditions */
  reasons: string[];
  /** The valid SLA that ends last, or null */
  sla: ApprovalSla | null;
}

export interface ApprovalInput {
  endorsement: Endorsement;
  /** `developmentStatus` of the scanned publiccode.yml; null when it is not declared */
  developmentStatus: string | null;
  /** Organisations under `usedBy` in the scanned publiccode.yml; null when the scan did not record them */
  declaredUserCount: number | null;
  slas: ApprovalSla[];
  minUsers: number;
  /** Today as YYYY-MM-DD */
  today: string;
}

/**
 * Approved is the level above Suitable for Common Ground: the component is
 * suitable, its publiccode.yml declares `developmentStatus: stable` and at
 * least `minUsers` organisations under `usedBy`, and an SLA is valid. Usage
 * counts only here, never in a rating.
 */
export function computeApproval(input: ApprovalInput): Approval {
  const reasons: string[] = [];
  if (!input.endorsement.passed) reasons.push("Not yet suitable for Common Ground");
  if (input.developmentStatus?.toLowerCase() !== "stable") {
    reasons.push(
      `development status is ${input.developmentStatus ?? "not declared"}, only stable components can be approved`
    );
  }

  if (input.declaredUserCount === null) {
    reasons.push("Users not counted yet: the latest scan did not record usedBy");
  } else if (input.declaredUserCount < input.minUsers) {
    reasons.push(`${input.declaredUserCount} of ${input.minUsers} users declared in publiccode.yml`);
  }

  const byEnd = [...input.slas].sort((a, b) => b.until.localeCompare(a.until));
  const sla = byEnd.find((candidate) => isSlaValid(candidate, input.today)) ?? null;
  if (byEnd.length === 0) reasons.push("No SLA");
  else if (!sla) reasons.push(`SLA expired on ${byEnd[0].until}`);

  return { approved: reasons.length === 0, reasons, sla };
}
