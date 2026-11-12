import { spawn } from "node:child_process";

/** Exit code reported when the script was killed at its time limit. */
export const TIMED_OUT = 124;

/** Runs a vendored Python script; stdout is discarded, stderr is returned for diagnostics. */
export function runPythonScript(
  scriptPath: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("python3", [scriptPath, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stderr: error.message });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: signal ? TIMED_OUT : code ?? 1, stderr });
    });
  });
}
