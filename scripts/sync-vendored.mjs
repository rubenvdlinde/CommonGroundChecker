// Refreshes a vendored analysis script from its upstream repository.
// Usage: node scripts/sync-vendored.mjs <maintainability|open-source-health> [commit-sha]
import { writeFile } from "node:fs/promises";
import path from "node:path";

const UPSTREAM_REPO = "ConductionNL/.github";
const SCRIPTS = {
  maintainability: {
    upstreamPath: "hydra-gates/scripts/lib/check_sig_maintainability.py",
    file: "check_maintainability.py",
  },
  "open-source-health": {
    upstreamPath: "hydra-gates/scripts/lib/check_open_source_health.py",
    file: "check_open_source_health.py",
  },
};

const [name, ref = "main"] = process.argv.slice(2);
const script = SCRIPTS[name];
if (!script) throw new Error(`Usage: node scripts/sync-vendored.mjs <${Object.keys(SCRIPTS).join("|")}> [commit-sha]`);

const shaResponse = await fetch(`https://api.github.com/repos/${UPSTREAM_REPO}/commits/${ref}`, {
  headers: { Accept: "application/vnd.github.sha" },
});
if (!shaResponse.ok) throw new Error(`Could not resolve ${ref}: HTTP ${shaResponse.status}`);
const sha = (await shaResponse.text()).trim();

const response = await fetch(`https://raw.githubusercontent.com/${UPSTREAM_REPO}/${sha}/${script.upstreamPath}`);
if (!response.ok) throw new Error(`Could not download ${script.upstreamPath} at ${sha}: HTTP ${response.status}`);

const targetDir = path.join(process.cwd(), "scripts", name);
await writeFile(path.join(targetDir, script.file), await response.text());
await writeFile(path.join(targetDir, "UPSTREAM"), `${sha}\n`);
console.log(`Vendored ${script.upstreamPath} at ${sha}`);
