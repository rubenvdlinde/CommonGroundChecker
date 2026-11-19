/**
 * Writes checker-fingerprint.json for the checker image, which does not
 * carry the sources the fingerprint is computed from.
 *
 *   npx tsx scripts/write-checker-fingerprint.ts
 */
import { writeFileSync } from "node:fs";
import { CHECKER_FINGERPRINT_FILE, computeCheckerFingerprint } from "../src/lib/checkerFingerprint";

const fingerprint = computeCheckerFingerprint(process.cwd());
writeFileSync(CHECKER_FINGERPRINT_FILE, `${JSON.stringify(fingerprint, null, 1)}\n`);
process.stdout.write(`${fingerprint.fingerprint} (${fingerprint.tools.join(", ")})\n`);
