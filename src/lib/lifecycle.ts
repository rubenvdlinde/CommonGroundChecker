import { computeMaintained, type MaintainedSla } from "./maintained";
import type { Endorsement } from "./types";

/** The status of a component in the Common Ground programme, from Listed to Retired. */
export type LifecycleStatus = "listed" | "measured" | "suitable" | "maintained" | "retired";

/** The statuses in the order of the lifecycle; Retired last. */
export const LIFECYCLE_STATUSES: LifecycleStatus[] = ["listed", "measured", "suitable", "maintained", "retired"];

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  listed: "Listed",
  measured: "Measured",
  suitable: "Suitable for Common Ground",
  maintained: "Maintained",
  retired: "Retired",
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
  /** Organisations under `usedBy` in the latest scanned publiccode.yml; null when not recorded */
  declaredUserCount: number | null;
  slas: MaintainedSla[];
  minUsers: number;
  /** Today as YYYY-MM-DD */
  today: string;
  /** When an admin retired the repository, or null */
  retiredAt: string | null;
  retiredReason: string | null;
  drops: OpenDrops;
}

export interface LifecycleResult {
  status: LifecycleStatus;
  label: string;
  /** Why the component is not at the next status up; empty at Maintained and Retired */
  reasons: string[];
  /** A note that does not change the status, such as an open drop on a Maintained component */
  note: string | null;
  /** Why a component is Retired: the scanned developmentStatus, or an admin */
  retiredBy: "obsolete" | "admin" | null;
  retiredReason: string | null;
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
    retiredBy: null,
    retiredReason: null,
    ...fields,
  };
}

/**
 * The one Common Ground status of a repository.
 *
 * Retired wins: an admin retired it, or the scanned publiccode.yml says
 * `developmentStatus: obsolete`. Without a stored analysis it is Listed.
 * When the verdict does not hold it is Measured, otherwise Suitable for
 * Common Ground. Maintained adds a stable developmentStatus, enough
 * declared users and a valid SLA (see `computeMaintained`). While a drop
 * is open and within its fix term, a component that meets those
 * conditions stays Maintained, with a note, even when the drop cost the
 * verdict. Once a fix term has passed it is Suitable, or Measured when the
 * verdict is lost too.
 */
export function computeLifecycleStatus(input: LifecycleInput): LifecycleResult {
  if (input.retiredAt) {
    return result("retired", { retiredBy: "admin", retiredReason: input.retiredReason });
  }
  if (input.developmentStatus?.trim().toLowerCase() === "obsolete") {
    return result("retired", {
      retiredBy: "obsolete",
      retiredReason: "developmentStatus is obsolete in publiccode.yml",
    });
  }
  if (!input.hasAnalysis || !input.endorsement) {
    return result("listed", { reasons: ["Not measured yet"] });
  }
  const maintained = computeMaintained({
    endorsement: { passed: true, reasons: [] },
    developmentStatus: input.developmentStatus,
    declaredUserCount: input.declaredUserCount,
    slas: input.slas,
    minUsers: input.minUsers,
    today: input.today,
  });
  const inFixTerm = input.drops.open > 0 && input.drops.overdue === 0;
  const openDropNote = inFixTerm && input.drops.nextFixBy
    ? `Open drop, fix by ${formatLifecycleDate(input.drops.nextFixBy)}`
    : null;

  if (!input.endorsement.passed) {
    // A drop that cost the verdict leaves a Maintained component Maintained while its fix term runs.
    if (maintained.maintained && inFixTerm) return result("maintained", { note: openDropNote });
    return result("measured", {
      reasons: input.endorsement.reasons.length > 0 ? input.endorsement.reasons : ["The verdict does not hold"],
    });
  }
  if (!maintained.maintained) return result("suitable", { reasons: maintained.reasons });

  if (input.drops.overdue > 0) {
    const count = input.drops.overdue;
    return result("suitable", {
      reasons: [`${count} ${count === 1 ? "drop is" : "drops are"} past the fix term`],
    });
  }
  return result("maintained", { note: openDropNote });
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
