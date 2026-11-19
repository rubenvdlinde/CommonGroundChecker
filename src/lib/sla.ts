import {
  SLA_CATEGORIES,
  SLA_CATEGORY_LABELS,
  SLA_ISSUE_TYPES,
  type SlaCategory,
  type SlaLabelTarget,
  type SlaTerm,
} from "@/lib/maintenanceTerms";
import type { SlaBreach, SlaCategorySummary, SlaSummary, SlaTimes } from "@/lib/types";

/** Working days are counted on the clock of this time zone. */
export const SLA_TIME_ZONE = "Europe/Amsterdam";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many open breaches a summary lists, longest overdue first. */
export const OPEN_BREACHES_SHOWN = 20;

function zoneOffsetMs(time: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
  return asUtc - Math.floor(time / 60000) * 60000;
}

/** The local wall clock time in the time zone, as milliseconds since the epoch. */
function toLocal(time: number, timeZone: string): number {
  return time + zoneOffsetMs(time, timeZone);
}

function fromLocal(local: number, timeZone: string): number {
  const first = local - zoneOffsetMs(local, timeZone);
  return local - zoneOffsetMs(first, timeZone);
}

/** Easter Sunday of a Gregorian year (anonymous Gregorian algorithm), as a UTC date. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const holidayCache = new Map<number, Set<string>>();

/**
 * The Dutch national public holidays of a year as YYYY-MM-DD: Nieuwjaarsdag,
 * Goede Vrijdag, Eerste en Tweede Paasdag, Koningsdag (27 April, or 26 April
 * when the 27th is a Sunday), Bevrijdingsdag, Hemelvaartsdag, Eerste en
 * Tweede Pinksterdag, Eerste en Tweede Kerstdag. Bevrijdingsdag counts every
 * year, as the cao Rijk gives it to the public sector (article 4.2).
 */
export function dutchPublicHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year).getTime();
  const fromEaster = (days: number) => new Date(easter + days * DAY_MS).toISOString().slice(0, 10);
  const kingsDay = new Date(Date.UTC(year, 3, 27)).getUTCDay() === 0 ? 26 : 27;
  const date = (month: number, day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const holidays = new Set([
    date(1, 1),
    fromEaster(-2),
    fromEaster(0),
    fromEaster(1),
    date(4, kingsDay),
    date(5, 5),
    fromEaster(39),
    fromEaster(49),
    fromEaster(50),
    date(12, 25),
    date(12, 26),
  ]);
  holidayCache.set(year, holidays);
  return holidays;
}

function isWorkingDay(localDayStart: number): boolean {
  const day = new Date(localDayStart);
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !dutchPublicHolidays(day.getUTCFullYear()).has(day.toISOString().slice(0, 10));
}

/**
 * Working days between two moments: the time that falls on Monday to
 * Friday on the clock of the time zone, in days, leaving out the Dutch
 * national public holidays.
 */
export function workingDaysBetween(start: Date, end: Date, timeZone: string = SLA_TIME_ZONE): number {
  const from = toLocal(start.getTime(), timeZone);
  const to = toLocal(end.getTime(), timeZone);
  if (to <= from) return 0;
  let total = 0;
  for (let dayStart = Math.floor(from / DAY_MS) * DAY_MS; dayStart < to; dayStart += DAY_MS) {
    if (!isWorkingDay(dayStart)) continue;
    total += Math.min(to, dayStart + DAY_MS) - Math.max(from, dayStart);
  }
  return total / DAY_MS;
}

/** The moment a number of working days after `start` have passed. */
export function addWorkingDays(start: Date, days: number, timeZone: string = SLA_TIME_ZONE): Date {
  let cursor = toLocal(start.getTime(), timeZone);
  let remaining = days * DAY_MS;
  while (remaining > 0) {
    const dayStart = Math.floor(cursor / DAY_MS) * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    if (isWorkingDay(dayStart)) {
      const used = Math.min(remaining, dayEnd - cursor);
      cursor += used;
      remaining -= used;
    } else {
      cursor = dayEnd;
    }
  }
  return new Date(fromLocal(cursor, timeZone));
}

/** An issue as the SLA measurement reads it. */
export interface SlaIssue {
  title: string;
  url: string;
  createdAt: string;
  closedAt: string | null;
  /** "COMPLETED", "NOT_PLANNED", "DUPLICATE" or null when open */
  stateReason: string | null;
  /** Label names in lower case */
  labels: string[];
  /** The GitHub issue type, such as "Bug", or null */
  issueType: string | null;
  /** The first comment or label by a maintainer, not the author and not a bot */
  firstResponseAt: string | null;
  /** Opened by an owner, member or collaborator: it needs no response */
  reportedByMaintainer: boolean;
  /** When the pull request or commit that closed the issue was merged or made */
  closingChangeAt: string | null;
}

/** A published security advisory of a repository. */
export interface SlaAdvisory {
  title: string;
  url: string;
  severity: string;
  createdAt: string;
  publishedAt: string;
}

export interface SlaInput {
  from: string;
  to: string;
  issues: SlaIssue[];
  /** Publication dates of stable releases */
  releases: string[];
  /** Published advisories, or why they could not be read */
  advisories: SlaAdvisory[] | { notMeasured: string };
  /** Notes on what the sample covers */
  notes?: string[];
}

const CATEGORY_RANK: Record<SlaCategory, number> = Object.fromEntries(
  SLA_CATEGORIES.map((category, index) => [category, index])
) as Record<SlaCategory, number>;

/**
 * The category of an issue from its labels and issue type: the most severe
 * category any of them names, else unclassified. `noFixTerm` is set by a
 * label such as `wontfix`: the issue keeps its response term only.
 */
export function classifyIssue(
  issue: Pick<SlaIssue, "labels" | "issueType">,
  labels: Record<string, SlaLabelTarget>
): { category: SlaCategory; noFixTerm: boolean } {
  const targets = issue.labels.map((label) => labels[label.toLowerCase()]).filter(Boolean);
  const typeTarget = issue.issueType ? SLA_ISSUE_TYPES[issue.issueType.toLowerCase()] : undefined;
  if (typeTarget) targets.push(typeTarget);
  const categories = targets.filter((target): target is Exclude<SlaLabelTarget, "no-fix-term"> => target !== "no-fix-term");
  const category: SlaCategory = categories.sort((a, b) => CATEGORY_RANK[a] - CATEGORY_RANK[b])[0] ?? "unclassified";
  return { category, noFixTerm: targets.includes("no-fix-term") };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

class TimesCounter {
  private readonly values: number[] = [];
  private breaches = 0;
  private waiting = 0;

  measured(days: number, breached: boolean) {
    this.values.push(days);
    if (breached) this.breaches += 1;
  }

  stillWaiting(breached: boolean) {
    this.waiting += 1;
    if (breached) this.breaches += 1;
  }

  summary(): SlaTimes {
    const middle = median(this.values);
    return {
      measured: this.values.length,
      median: middle === null ? null : round(middle),
      worst: this.values.length > 0 ? round(Math.max(...this.values)) : null,
      breaches: this.breaches,
      waiting: this.waiting,
    };
  }
}

/** The first stable release published at or after a moment. */
function firstReleaseAfter(releases: number[], time: number): number | null {
  return releases.find((release) => release >= time) ?? null;
}

/**
 * Measures issue response and fix times against the SLA terms.
 *
 * - Response: from opening to the first comment or label by a maintainer.
 * - Fix: the first stable release published after the change that closed
 *   the issue; when no closing change is known, closing it as completed.
 *   An issue closed as not planned or duplicate has no fix.
 * - "next-release": a bug is due in the first stable release published
 *   after its response term ends.
 */
export function summarizeSla(
  input: SlaInput,
  terms: Record<SlaCategory, SlaTerm>,
  labels: Record<string, SlaLabelTarget>,
  now: Date
): SlaSummary {
  const releases = input.releases.map((date) => Date.parse(date)).filter(Number.isFinite).sort((a, b) => a - b);
  const counts = new Map<SlaCategory, number>();
  const responses = new Map<SlaCategory, TimesCounter>();
  const fixes = new Map<SlaCategory, TimesCounter>();
  const openBreaches: SlaBreach[] = [];
  let fixesByRelease = 0;
  let reportedByMaintainers = 0;
  let fixesByClose = 0;
  const counter = (map: Map<SlaCategory, TimesCounter>, category: SlaCategory) => {
    const existing = map.get(category);
    if (existing) return existing;
    const created = new TimesCounter();
    map.set(category, created);
    return created;
  };

  for (const issue of input.issues) {
    const { category, noFixTerm } = classifyIssue(issue, labels);
    counts.set(category, (counts.get(category) ?? 0) + 1);
    const term = terms[category];
    const created = new Date(issue.createdAt);
    const isOpen = issue.closedAt === null;

    if (issue.reportedByMaintainer) reportedByMaintainers += 1;
    const responseTimes = term.respondDays !== null ? counter(responses, category) : null;
    if (responseTimes && term.respondDays !== null && !issue.reportedByMaintainer) {
      const due = addWorkingDays(created, term.respondDays);
      if (issue.firstResponseAt) {
        const answered = new Date(issue.firstResponseAt);
        responseTimes.measured(workingDaysBetween(created, answered), answered.getTime() > due.getTime());
      } else {
        const breached = now.getTime() > due.getTime();
        responseTimes.stillWaiting(breached);
        if (breached && isOpen) {
          openBreaches.push({ title: issue.title, url: issue.url, category, kind: "response", due: due.toISOString() });
        }
      }
    }

    if (term.fixDays === null || noFixTerm) continue;
    if (issue.stateReason === "NOT_PLANNED" || issue.stateReason === "DUPLICATE") continue;
    const dueTime =
      term.fixDays === "next-release"
        ? firstReleaseAfter(releases, addWorkingDays(created, term.respondDays ?? 0).getTime())
        : addWorkingDays(created, term.fixDays).getTime();

    let fixedAt: number | null = null;
    if (issue.closingChangeAt) {
      fixedAt = firstReleaseAfter(releases, Date.parse(issue.closingChangeAt));
      if (fixedAt !== null) fixesByRelease += 1;
    } else if (issue.closedAt && issue.stateReason === "COMPLETED") {
      fixedAt = Date.parse(issue.closedAt);
      fixesByClose += 1;
    }

    const fixTimes = counter(fixes, category);
    if (fixedAt !== null) {
      fixTimes.measured(workingDaysBetween(created, new Date(fixedAt)), dueTime !== null && fixedAt > dueTime);
    } else {
      const breached = dueTime !== null && now.getTime() > dueTime;
      fixTimes.stillWaiting(breached);
      if (breached && dueTime !== null) {
        openBreaches.push({
          title: issue.title,
          url: issue.url,
          category,
          kind: "fix",
          due: new Date(dueTime).toISOString(),
        });
      }
    }
  }

  const notes = [...(input.notes ?? [])];
  if (Array.isArray(input.advisories)) {
    for (const advisory of input.advisories) {
      const category: SlaCategory | null =
        advisory.severity === "critical" ? "critical-vulnerability" : advisory.severity === "high" ? "high-vulnerability" : null;
      if (!category) continue;
      counts.set(category, (counts.get(category) ?? 0) + 1);
      const term = terms[category];
      if (typeof term.fixDays !== "number") continue;
      const created = new Date(advisory.createdAt);
      const published = new Date(advisory.publishedAt);
      const due = addWorkingDays(created, term.fixDays);
      counter(fixes, category).measured(workingDaysBetween(created, published), published.getTime() > due.getTime());
    }
    notes.push(
      "Vulnerabilities are read from the published GitHub security advisories, from draft to publication. Their response time, unpublished advisories and Dependabot alerts need admin rights and are not measured."
    );
  } else {
    notes.push(`Vulnerabilities are not measured: ${input.advisories.notMeasured}.`);
  }
  if (reportedByMaintainers > 0) {
    notes.push(
      `${reportedByMaintainers} of ${input.issues.length} issues were opened by the maintainers themselves; they have a fix term but no response term.`
    );
  }
  if ((counts.get("blocking-bug") ?? 0) === 0 && (counts.get("bug") ?? 0) > 0) {
    notes.push("No issue carries a blocking label (such as blocker or critical), so every bug counts as an other bug.");
  }

  const categories: SlaCategorySummary[] = SLA_CATEGORIES.flatMap((category) => {
    const count = counts.get(category) ?? 0;
    if (count === 0) return [];
    const term = terms[category];
    const isVulnerability = category === "critical-vulnerability" || category === "high-vulnerability";
    return [
      {
        category,
        label: SLA_CATEGORY_LABELS[category],
        respondDays: term.respondDays,
        fixDays: term.fixDays,
        count,
        response: isVulnerability ? null : (responses.get(category)?.summary() ?? null),
        fix: fixes.get(category)?.summary() ?? null,
      },
    ];
  });

  return {
    notMeasured: null,
    from: input.from,
    to: input.to,
    categories,
    openBreachCount: openBreaches.length,
    openBreaches: openBreaches.sort((a, b) => a.due.localeCompare(b.due)).slice(0, OPEN_BREACHES_SHOWN),
    fixesByRelease,
    fixesByClose,
    notes,
  };
}

/** An SLA summary that could not be measured. */
export function slaNotMeasured(reason: string, now: Date): SlaSummary {
  const to = now.toISOString().slice(0, 10);
  return {
    notMeasured: reason,
    from: to,
    to,
    categories: [],
    openBreaches: [],
    openBreachCount: 0,
    fixesByRelease: 0,
    fixesByClose: 0,
    notes: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseTimes(raw: unknown): SlaTimes | null {
  if (!isRecord(raw)) return null;
  const { measured, median: middle, worst, breaches, waiting } = raw;
  if (typeof measured !== "number" || typeof breaches !== "number" || typeof waiting !== "number") return null;
  if (!isNumberOrNull(middle) || !isNumberOrNull(worst)) return null;
  return { measured, median: middle, worst, breaches, waiting };
}

/** The SLA summary of a stored check result; undefined when it is missing or malformed. */
export function parseSla(raw: unknown): SlaSummary | undefined {
  if (!isRecord(raw)) return undefined;
  const { notMeasured, from, to, categories, openBreaches, openBreachCount, fixesByRelease, fixesByClose, notes } = raw;
  if (notMeasured !== null && typeof notMeasured !== "string") return undefined;
  if (typeof from !== "string" || typeof to !== "string") return undefined;
  if (!Array.isArray(categories) || !Array.isArray(openBreaches) || !Array.isArray(notes)) return undefined;
  return {
    notMeasured,
    from,
    to,
    categories: categories.flatMap((item): SlaCategorySummary[] => {
      if (!isRecord(item) || typeof item.category !== "string" || typeof item.label !== "string") return [];
      if (typeof item.count !== "number" || !isNumberOrNull(item.respondDays)) return [];
      const fixDays = item.fixDays === "next-release" || isNumberOrNull(item.fixDays) ? item.fixDays : null;
      return [
        {
          category: item.category,
          label: item.label,
          respondDays: item.respondDays,
          fixDays,
          count: item.count,
          response: parseTimes(item.response),
          fix: parseTimes(item.fix),
        },
      ];
    }),
    openBreaches: openBreaches.flatMap((item): SlaBreach[] =>
      isRecord(item) &&
      typeof item.title === "string" &&
      typeof item.url === "string" &&
      typeof item.category === "string" &&
      (item.kind === "response" || item.kind === "fix") &&
      typeof item.due === "string"
        ? [{ title: item.title, url: item.url, category: item.category, kind: item.kind, due: item.due }]
        : []
    ),
    openBreachCount: typeof openBreachCount === "number" ? openBreachCount : openBreaches.length,
    fixesByRelease: typeof fixesByRelease === "number" ? fixesByRelease : 0,
    fixesByClose: typeof fixesByClose === "number" ? fixesByClose : 0,
    notes: notes.filter((note): note is string => typeof note === "string"),
  };
}
