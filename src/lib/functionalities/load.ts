/** Reads config/functionalities.yml when the site is built or a page is rendered on the server. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseYaml } from "@/lib/staticSite/config";
import { EMPTY_TAXONOMY, readTaxonomy, type FunctionalityTaxonomy } from "./taxonomy";

/** config/functionalities.yml, or the file CGC_FUNCTIONALITIES_FILE names. */
export function functionalitiesFile(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.CGC_FUNCTIONALITIES_FILE || "config/functionalities.yml");
}

/** The taxonomy; empty when the file does not exist. */
export async function loadTaxonomy(file: string = functionalitiesFile()): Promise<FunctionalityTaxonomy> {
  try {
    return readTaxonomy(parseYaml(await readFile(file, "utf-8")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_TAXONOMY;
    throw err;
  }
}
