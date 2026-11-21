import { slaMissingText, slaStateOf, type MaintainedDecision, type MaintainedSla } from "./maintained";
import { isAdoptionReason } from "./ratings";
import type { Endorsement } from "./types";

/** The status of a component in the Common Ground programme, from Listed to Maintained. */
export type LifecycleStatus = "listed" | "measured" | "suitable" | "maintained";

/** The statuses in the order of the lifecycle. */
export const LIFECYCLE_STATUSES: LifecycleStatus[] = ["listed", "measured", "suitable", "maintained"];

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  listed: "Listed",
  measured: "Measured",
  suitable: "Suitable for Common Ground",
  maintained: "Maintained",
};

/** Short labels, for a chip or a filter. */
export const LIFECYCLE_SHORT_LABELS: Record<LifecycleStatus, string> = {
  ...LIFECYCLE_LABELS,
  suitable: "Suitable",
};

export function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return typeof value === "string" && (LIFECYCLE_STATUSES as string[]).includes(value);
}

/** The open drops of a repository: how many, how many are past their fix-by date, and the earliest fix-by date. */
export interface OpenDrops {
  open: number;
  overdue: number;
  /** ISO date or date-time of the earliest fix-by date, or null */
  nextFixBy: string | null;
}

export const NO_OPEN_DROPS: OpenDrops = { open: 0, overdue: 0, nextFixBy: null };

export interface LifecycleInput {
  /** Whether a completed analysis is stored */
  hasAnalysis: boolean;
  /** The verdict of the latest analysis; null without one */
  endorsement: Endorsement | null;
  /** `developmentStatus` of the latest scanned publiccode.yml */
  developmentStatus: string | null;
  slas: MaintainedSla[];
  /** Today as YYYY-MM-DD */
  today: string;
  /** VNG's decision to take the component into management, from config/repositories.yml; null without one */
  decision: MaintainedDecision | null;
  drops: OpenDrops;
}

export interface LifecycleResult {
  status: LifecycleStatus;
  label: string;
  /** Why the component is not at the next status up; empty at Maintained */
  reasons: string[];
  /** A note that does not change the status, such as an open drop on a Maintained component */
  note: string | null;
  /** The recorded VNG decision; it stays recorded when the component falls back */
  decision: MaintainedDecision | null;
}

/** "19-11-2026" for an ISO date or date-time, in Dutch time. */
export function formatLifecycleDate(value: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  return new Date(day).toLocaleDateString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function result(status: LifecycleStatus, fields: Partial<LifecycleResult> = {}): LifecycleResult {
  return {
    status,
    label: LIFECYCLE_LABELS[status],
    reasons: [],
    note: null,
    decision: null,
    ...fields,
  };
}

/** The note on a component that VNG decided to maintain but that fell back. */
export const DECIDED_NOT_SUITABLE_NOTE = "Maintained by VNG decision, not suitable now";
export const DECIDED_TERM_PASSED_NOTE = "Maintained by VNG decision, a fix term has passed";

/**
 * The one Common Ground status of a repository.
 *
 * Without a stored analysis it is Listed. When the verdict does not hold it
 * is Measured, otherwise Suitable for Common Ground. Maintained adds VNG's
 * decision to take the component into management; without that decision a
 * component is at most Suitable, whatever its SLA. After the decision the
 * SLA and the drops have fix terms. While a drop is open within its term,
 * or the SLA is missing within its term, the component stays Maintained
 * with a note, also when the drop cost the verdict. Once a term has passed
 * it falls back: to Measured when the verdict is lost, otherwise to
 * Suitable. The decision stays recorded.
 */
export function computeLifecycleStatus(input: LifecycleInput): LifecycleResult {
  if (!input.hasAnalysis || !input.endorsement) {
    return result("listed", { reasons: ["Not measured yet"] });
  }
  const decision = input.decision;
  const sla = decision ? slaStateOf(decision, input.slas, input.today) : null;
  const inFixTerm = input.drops.open > 0 && input.drops.overdue === 0;
  const openDropNote = inFixTerm && input.drops.nextFixBy
    ? `Open drop, fix by ${formatLifecycleDate(input.drops.nextFixBy)}`
    : null;
  const slaNote = sla && !sla.overdue ? slaMissingText(sla) : null;

  if (!input.endorsement.passed) {
    // A drop that cost the verdict leaves a Maintained component Maintained while its fix term runs.
    // Leaving stable or losing users is not a drop.
    const lostOnPubliccode = input.endorsement.reasons.some(isAdoptionReason);
    if (decision && inFixTerm && !lostOnPubliccode && !sla?.overdue) {
      return result("maintained", { note: [openDropNote, slaNote].filter(Boolean).join("; ") || null, decision });
    }
    return result("measured", {
      reasons: input.endorsement.reasons.length > 0 ? input.endorsement.reasons : ["The verdict does not hold"],
      note: decision ? DECIDED_NOT_SUITABLE_NOTE : null,
      decision,
    });
  }
  if (!decision || !sla) return result("suitable", { reasons: ["No VNG decision to take it into management"] });

  const passed: string[] = [];
  if (input.drops.overdue > 0) {
    const count = input.drops.overdue;
    passed.push(`${count} ${count === 1 ? "drop is" : "drops are"} past the fix term`);
  }
  if (sla.overdue) passed.push(slaMissingText(sla) as string);
  if (passed.length > 0) return result("suitable", { reasons: passed, note: DECIDED_TERM_PASSED_NOTE, decision });

  return result("maintained", { note: [openDropNote, slaNote].filter(Boolean).join("; ") || null, decision });
}

/** The open drops in a list of drops, as the repository page has them. */
export function openDropsOf(
  drops: Array<{ resolvedAt: string | null; overdue: boolean; fixBy: string }>
): OpenDrops {
  const open = drops.filter((drop) => drop.resolvedAt === null);
  const fixBy = open.map((drop) => drop.fixBy).sort();
  return {
    open: open.length,
    overdue: open.filter((drop) => drop.overdue).length,
    nextFixBy: fixBy[0] ?? null,
  };
}
