import { afterEach, describe, expect, it } from "vitest";

import { DISPLAY_TIME_ZONE, formatDateTime } from "@/lib/dates";

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("formatDateTime", () => {
  it("shows times in the Amsterdam time zone", () => {
    expect(DISPLAY_TIME_ZONE).toBe("Europe/Amsterdam");
    expect(formatDateTime("2026-01-15T09:05:44Z")).toBe("15-1-2026, 10:05:44");
  });

  it("follows the daylight saving change", () => {
    expect(formatDateTime("2026-03-29T00:30:00Z")).toBe("29-3-2026, 01:30:00");
    expect(formatDateTime("2026-03-29T01:30:00Z")).toBe("29-3-2026, 03:30:00");
    expect(formatDateTime("2026-10-25T00:30:00Z")).toBe("25-10-2026, 02:30:00");
    expect(formatDateTime("2026-10-25T01:30:00Z")).toBe("25-10-2026, 02:30:00");
  });

  it("gives the same string whatever the process time zone is", () => {
    const instants = ["2026-01-15T09:05:44Z", "2026-07-01T22:59:59Z", "2026-10-25T01:30:00Z"];
    const outputs = ["UTC", "America/New_York", "Asia/Tokyo", "Europe/Amsterdam"].map((tz) => {
      process.env.TZ = tz;
      return instants.map(formatDateTime);
    });

    for (const output of outputs) {
      expect(output).toEqual(outputs[0]);
    }
  });

  it("keeps the format of the nl-NL locale string", () => {
    process.env.TZ = DISPLAY_TIME_ZONE;
    const instant = "2026-11-12T10:05:44Z";
    expect(formatDateTime(instant)).toBe(new Date(instant).toLocaleString("nl-NL"));
  });
});
