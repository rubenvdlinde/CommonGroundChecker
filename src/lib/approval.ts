import type { CheckResult, Endorsement } from "./types";

/** The proposed minimum of confirmed users for Approved; `MIN_CONFIRMED_USERS` overrides it. */
export const DEFAULT_MIN_CONFIRMED_USERS = 2;

/** `MIN_CONFIRMED_USERS` as a whole number of at least 1, else the default. */
export function minConfirmedUsers(value: string | undefined = process.env.MIN_CONFIRMED_USERS): number {
  const parsed = Number(value?.trim());
  return value?.trim() && Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_MIN_CONFIRMED_USERS;
}

/** The organisations under `usedBy` in the scanned publiccode.yml; empty when it has none. */
export function declaredUsersOf(results: CheckResult[]): string[] {
  return results.find((result) => result.publiccode)?.publiccode?.usedBy ?? [];
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
  /** Approved: suitable for Common Ground, enough confirmed users and a valid SLA */
  approved: boolean;
  /** Why the component is not approved, in the order of the conditions */
  reasons: string[];
  /** The valid SLA that ends last, or null */
  sla: ApprovalSla | null;
}

export interface ApprovalInput {
  endorsement: Endorsement;
  /** Declared users with a confirmation; null when the latest scan did not record usedBy */
  confirmedUserCount: number | null;
  slas: ApprovalSla[];
  minConfirmedUsers: number;
  /** Today as YYYY-MM-DD */
  today: string;
}

/**
 * Approved is the level above Suitable for Common Ground: the component is
 * suitable, at least `minConfirmedUsers` declared organisations confirmed
 * they use it, and an SLA is valid. Usage counts only here, never in a rating.
 */
export function computeApproval(input: ApprovalInput): Approval {
  const reasons: string[] = [];
  if (!input.endorsement.passed) reasons.push("Not yet suitable for Common Ground");

  if (input.confirmedUserCount === null) {
    reasons.push("Confirmed users not counted yet: the latest scan did not record usedBy");
  } else if (input.confirmedUserCount < input.minConfirmedUsers) {
    reasons.push(`${input.confirmedUserCount} of ${input.minConfirmedUsers} confirmed users`);
  }

  const byEnd = [...input.slas].sort((a, b) => b.until.localeCompare(a.until));
  const sla = byEnd.find((candidate) => isSlaValid(candidate, input.today)) ?? null;
  if (byEnd.length === 0) reasons.push("No SLA");
  else if (!sla) reasons.push(`SLA expired on ${byEnd[0].until}`);

  return { approved: reasons.length === 0, reasons, sla };
}
