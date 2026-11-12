/**
 * Time zone in which every date in the UI is shown. Fixing it keeps the
 * server render (container time zone) and the browser render identical.
 */
export const DISPLAY_TIME_ZONE = "Europe/Amsterdam";

const dateTimeFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

/** Formats an ISO timestamp as a Dutch date and time, e.g. "5-3-2026, 10:05:04". */
export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormat.format(new Date(value));
}
