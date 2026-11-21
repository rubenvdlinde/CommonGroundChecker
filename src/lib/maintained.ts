import type { MaintainedDecision } from "./staticSite/config";
import type { CheckResult, Endorsement } from "./types";

export type { MaintainedDecision };

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

/** A recorded decision from untyped data, such as a summary in index.json; null when it is missing or incomplete. */
export function maintainedDecisionOf(value: unknown): MaintainedDecision | null {
  if (!value || typeof value !== "object") return null;
  const { since, decision } = value as Record<string, unknown>;
  if (typeof since !== "string" || typeof decision !== "string" || !since || !decision) return null;
  return { since, decision };
}

/** Days a Maintained component has to get a valid SLA again: the default fix term of the verdict. */
export const SLA_FIX_TERM_DAYS = 30;

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The SLA of a component with a maintenance decision: the valid one, or since when it is missing and its fix term. */
export interface SlaState {
  /** The valid SLA that ends last, or null */
  sla: MaintainedSla | null;
  /** The first day without a valid SLA after the decision; null while an SLA is valid */
  missingSince: string | null;
  /** The last day of the fix term for the missing SLA, as YYYY-MM-DD; null while an SLA is valid */
  fixBy: string | null;
  /** The fix term has passed */
  overdue: boolean;
}

/**
 * The SLA follows the decision. Without a valid SLA the component gets a
 * fix term, from the decision or from the day after the last SLA ended,
 * whichever is later.
 */
export function slaStateOf(decision: MaintainedDecision, slas: MaintainedSla[], today: string): SlaState {
  const byEnd = [...slas].sort((a, b) => b.until.localeCompare(a.until));
  const sla = byEnd.find((candidate) => isSlaValid(candidate, today)) ?? null;
  if (sla) return { sla, missingSince: null, fixBy: null, overdue: false };
  const afterLast = byEnd.length > 0 ? addDays(byEnd[0].until, 1) : decision.since;
  const missingSince = afterLast > decision.since ? afterLast : decision.since;
  const fixBy = addDays(missingSince, SLA_FIX_TERM_DAYS);
  return { sla: null, missingSince, fixBy, overdue: today > fixBy };
}

export interface MaintainedLevelResult {
  /** Maintained: suitable for Common Ground, a VNG decision, and a valid SLA or one within its fix term */
  maintained: boolean;
  /** Why the component is not Maintained, in the order of the conditions */
  reasons: string[];
  /** The valid SLA that ends last, or null */
  sla: MaintainedSla | null;
  decision: MaintainedDecision | null;
  /** A missing SLA within its fix term; it does not change the level */
  note: string | null;
}

export interface MaintainedInput {
  endorsement: Endorsement;
  /** VNG's decision to take the component into management, or null */
  decision: MaintainedDecision | null;
  slas: MaintainedSla[];
  /** Today as YYYY-MM-DD */
  today: string;
}

/** "19-11-2026" for a YYYY-MM-DD day. */
function dutchDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}-${month}-${year}`;
}

/** Why an SLA that follows a decision is missing, with its fix term. */
export function slaMissingText(state: SlaState): string | null {
  if (!state.missingSince || !state.fixBy) return null;
  return state.overdue
    ? `No valid SLA since ${dutchDay(state.missingSince)}; the fix term ended on ${dutchDay(state.fixBy)}`
    : `No valid SLA, fix by ${dutchDay(state.fixBy)}`;
}

/**
 * Maintained is the level above Suitable for Common Ground. The component
 * is suitable, which already asks `developmentStatus: stable` and enough
 * organisations under `usedBy` in publiccode.yml, and VNG decided to take
 * it into management. The SLA is agreed after that decision: while it is
 * missing or expired the component keeps the level during a fix term.
 * Without a decision a component is at most Suitable, whatever its SLA.
 * Usage counts only in the verdict, never in a rating.
 */
export function computeMaintained(input: MaintainedInput): MaintainedLevelResult {
  const reasons: string[] = [];
  if (!input.endorsement.passed) reasons.push("Not yet suitable for Common Ground");
  if (!input.decision) {
    reasons.push("No VNG decision to take it into management");
    const byEnd = [...input.slas].sort((a, b) => b.until.localeCompare(a.until));
    const sla = byEnd.find((candidate) => isSlaValid(candidate, input.today)) ?? null;
    return { maintained: false, reasons, sla, decision: null, note: null };
  }
  const state = slaStateOf(input.decision, input.slas, input.today);
  const missing = slaMissingText(state);
  if (state.overdue && missing) reasons.push(missing);
  return {
    maintained: reasons.length === 0,
    reasons,
    sla: state.sla,
    decision: input.decision,
    note: state.overdue ? null : missing,
  };
}
