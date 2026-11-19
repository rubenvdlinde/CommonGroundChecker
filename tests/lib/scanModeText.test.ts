import { describe, expect, it } from "vitest";
import {
  codeUnchangedLine,
  codeUnchangedSince,
  readReusedFrom,
  reusedNote,
  scanDurationText,
} from "@/lib/scanModeText";

const COMMIT = "abc1234def5678abc1234def5678abc1234def56";

describe("scan mode text", () => {
  it("finds the earliest scan the reused results come from", () => {
    const older = { analysisId: "a", checkedAt: "2026-11-12T02:00:00Z", commit: COMMIT };
    const newer = { analysisId: "b", checkedAt: "2026-11-18T02:00:00Z", commit: COMMIT };

    expect(codeUnchangedSince([{ reusedFrom: newer }, {}, { reusedFrom: older }])).toEqual(older);
    expect(codeUnchangedSince([{}, {}])).toBeNull();
  });

  it("says since when the code is unchanged, with the short commit", () => {
    const from = { analysisId: "a", checkedAt: "2026-11-12T02:00:00Z", commit: COMMIT };

    expect(codeUnchangedLine(from)).toBe(
      "Code unchanged since 12 November 2026 (commit abc1234): code checks reused, outside-world checks run again"
    );
    expect(reusedNote(from)).toBe("Reused from the scan of 12 November 2026 (commit abc1234). The code did not change since.");
  });

  it("reads a stored reusedFrom and refuses a malformed one", () => {
    expect(readReusedFrom({ analysisId: "a", checkedAt: "2026-11-12T02:00:00Z", commit: COMMIT })).toEqual({
      analysisId: "a",
      checkedAt: "2026-11-12T02:00:00Z",
      commit: COMMIT,
    });
    expect(readReusedFrom({ checkedAt: "2026-11-12T02:00:00Z", commit: COMMIT })?.analysisId).toBeNull();
    expect(readReusedFrom({ checkedAt: "2026-11-12T02:00:00Z" })).toBeUndefined();
    expect(readReusedFrom("yes")).toBeUndefined();
  });

  it("gives the duration in seconds, or minutes and seconds", () => {
    expect(scanDurationText(4.24)).toBe("Scan took 4.2 s");
    expect(scanDurationText(182.4)).toBe("Scan took 3 min 2 s");
  });
});
