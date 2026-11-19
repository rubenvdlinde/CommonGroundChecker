/** A value from the forge API, or the reason it could not be measured. */
export type Measured<T> = { measured: true; value: T } | { measured: false; reason: string };

/** When an issue or change request was opened and first answered by someone else. */
export interface ResponseSample {
  createdAt: string;
  /** Null when nobody but the author or a bot responded */
  firstResponseAt: string | null;
}

/** A sample of issues or change requests opened in a window, with their first responses. */
export interface ResponseSet {
  /** Start and end of the window the sample was opened in */
  from: string;
  to: string;
  samples: ResponseSample[];
}

/** The commits of a period, counted per human author. */
export interface CommitCounts {
  /** Commits per author, without identities */
  counts: number[];
  /** Which commits were counted, for example "the last 12 months" */
  scope: string;
}

/**
 * The organisation of each sampled human commit; authors are numbered, not named.
 * The organisation is a domain, "company:<name>" from the author's profile, or
 * null when it is unknown.
 */
export interface CommitDomains {
  commits: Array<{ organisation: string | null; author: number }>;
  scope: string;
  /** Authors with a personal or hidden address whose profile was not looked up because of the limit */
  notLookedUp: number;
  /** False when the forge does not say which account made a commit, so no profile can be looked up */
  lookupAvailable: boolean;
}

/** The releases of a project. */
export interface Releases {
  /** Publication dates of the final releases, newest first */
  dates: string[];
  /** Publication dates of the pre-releases */
  prereleases: string[];
  /** False when the API was read only part of the way back to the start of the window */
  complete: boolean;
  /** Where the dates come from, for example "GitHub releases" or "version tags" */
  source: string;
}

/**
 * The project activity a forge API reports, reduced to counts and dates.
 * Logins, names and email addresses are used while fetching only.
 */
export interface ProjectActivity {
  contributorCommits: Measured<CommitCounts>;
  commitDomains: Measured<CommitDomains>;
  /** Change requests opened and closed (merged or not) in the last 90 days */
  changeRequests: Measured<{ opened: number; closed: number }>;
  changeRequestResponses: Measured<ResponseSet>;
  issueResponses: Measured<ResponseSet>;
  releases: Measured<Releases>;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The windows the activity is measured in. */
export interface ActivityWindows {
  /** Start of the last 12 months */
  year: Date;
  /** Start of the last 90 days */
  quarter: Date;
  /** Latest opening date sampled for response times, so each item had a week to get an answer */
  responseCutoff: Date;
}

export function activityWindows(now: Date): ActivityWindows {
  return {
    year: new Date(now.getTime() - 365 * DAY_MS),
    quarter: new Date(now.getTime() - 90 * DAY_MS),
    responseCutoff: new Date(now.getTime() - 7 * DAY_MS),
  };
}

/** Number of issues and of change requests sampled for response times. */
export const RESPONSE_SAMPLE_SIZE = 15;

const BOT_NAME = /\[bot\]$|(^|[-_.])bot$|^project_\d+_bot|^group_\d+_bot|^ghost$/i;

/** True for an account name that belongs to a bot or a deleted user. */
export function isBotName(name: string | null | undefined): boolean {
  return typeof name === "string" && BOT_NAME.test(name.trim());
}

/** The domain of an email address in lower case, or null. */
export function emailDomain(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/** Numbers authors in the order they appear, so the result keeps no identity. */
export function authorNumbering(): (key: string) => number {
  const numbers = new Map<string, number>();
  return (key: string) => {
    const normalised = key.trim().toLowerCase();
    const existing = numbers.get(normalised);
    if (existing !== undefined) return existing;
    numbers.set(normalised, numbers.size);
    return numbers.size - 1;
  };
}

/** The earliest of the dates, or null. */
export function earliest(dates: Array<string | null | undefined>): string | null {
  const times = dates.flatMap((date) => {
    const time = date ? Date.parse(date) : NaN;
    return Number.isFinite(time) ? [time] : [];
  });
  return times.length > 0 ? new Date(Math.min(...times)).toISOString() : null;
}

export function notMeasured(reason: string): { measured: false; reason: string } {
  return { measured: false, reason };
}

export function errorReason(api: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `the ${api} API answered with an error (${message.slice(0, 120)})`;
}
