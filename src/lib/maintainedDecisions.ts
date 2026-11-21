/**
 * VNG's maintenance decisions from config/repositories.yml, for the server.
 * The static site reads the same field from index.json, which the scan
 * writes from this file, so both modes show the same status.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { maintainedDecisionOf, type MaintainedDecision } from "@/lib/maintained";
import { normalizeRepositoryUrl, parseYaml } from "@/lib/staticSite/config";

/** config/repositories.yml, or the file CGC_REPOSITORIES_FILE names. */
export function repositoriesFile(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.CGC_REPOSITORIES_FILE || "config/repositories.yml");
}

function keyOf(url: string): string | null {
  try {
    return normalizeRepositoryUrl(url).toLowerCase();
  } catch {
    return null;
  }
}

/** The decisions in the parsed component list, by normalised repository URL. */
export function readMaintainedDecisions(raw: unknown): Map<string, MaintainedDecision> {
  const decisions = new Map<string, MaintainedDecision>();
  const list = raw && typeof raw === "object" ? (raw as { repositories?: unknown }).repositories : undefined;
  if (!Array.isArray(list)) return decisions;
  for (const item of list) {
    const { url, maintained } = (item ?? {}) as { url?: unknown; maintained?: unknown };
    const key = typeof url === "string" ? keyOf(url) : null;
    const decision = maintainedDecisionOf(maintained);
    if (key && decision) decisions.set(key, decision);
  }
  return decisions;
}

/** The decisions of the component list; empty when the file does not exist. */
export async function loadMaintainedDecisions(file: string = repositoriesFile()): Promise<Map<string, MaintainedDecision>> {
  try {
    return readMaintainedDecisions(parseYaml(await readFile(file, "utf-8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
}

/** The decision for a repository URL, or null. */
export function decisionFor(decisions: Map<string, MaintainedDecision>, repoUrl: string | null | undefined): MaintainedDecision | null {
  const key = repoUrl ? keyOf(repoUrl) : null;
  return key ? (decisions.get(key) ?? null) : null;
}
