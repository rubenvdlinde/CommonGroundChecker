import yaml from "js-yaml";
import type { CheckResult } from "../types";
import type { RepoContext } from "../providers/types";
import { detectLicenseFromText } from "./license";

const TITLE = "Licence consistency";
const DESCRIPTION =
  "Every place a repository declares its licence (LICENSE file, package manifests, publiccode.yml, Nextcloud appinfo/info.xml) should name the same licence.";
const REFERENCE_URL = "https://spdx.org/licenses/";

/**
 * Unambiguous licence spellings mapped to their SPDX identifier, keyed by the
 * lower-cased, whitespace-collapsed form. Values without a version (for example
 * `AGPL`) are families: the declaration names the licence but not its version,
 * so it is compared against the family only and never expanded to a version.
 */
export const LICENCE_ALIASES: Record<string, string> = {
  mit: "MIT",
  "mit license": "MIT",
  "mit licence": "MIT",
  "apache-2.0": "Apache-2.0",
  "apache 2.0": "Apache-2.0",
  "apache-2": "Apache-2.0",
  "apache 2": "Apache-2.0",
  apache2: "Apache-2.0",
  "apache license 2.0": "Apache-2.0",
  "apache license, version 2.0": "Apache-2.0",
  "apache license version 2.0": "Apache-2.0",
  "apache software license 2.0": "Apache-2.0",
  "eupl-1.2": "EUPL-1.2",
  "eupl 1.2": "EUPL-1.2",
  "eupl v1.2": "EUPL-1.2",
  "eupl-v1.2": "EUPL-1.2",
  "eupl v. 1.2": "EUPL-1.2",
  "eupl1.2": "EUPL-1.2",
  eupl12: "EUPL-1.2",
  "eupl-1.1": "EUPL-1.1",
  "eupl 1.1": "EUPL-1.1",
  "eupl v1.1": "EUPL-1.1",
  "eupl-v1.1": "EUPL-1.1",
  "eupl v. 1.1": "EUPL-1.1",
  "eupl1.1": "EUPL-1.1",
  eupl11: "EUPL-1.1",
  "eupl-1.0": "EUPL-1.0",
  "eupl 1.0": "EUPL-1.0",
  "eupl v1.0": "EUPL-1.0",
  "eupl-v1.0": "EUPL-1.0",
  eupl: "EUPL",
  agpl: "AGPL",
  gpl: "GPL",
  lgpl: "LGPL",
  "bsd 2-clause": "BSD-2-Clause",
  "bsd 3-clause": "BSD-3-Clause",
  "isc license": "ISC",
  "creative commons zero v1.0": "CC0-1.0",
  "mozilla public license 2.0": "MPL-2.0",
  // Names returned by detectLicenseFromText in license.ts
  "european union public licence (eupl) 1.2": "EUPL-1.2",
  "european union public licence (eupl) 1.1": "EUPL-1.1",
  "european union public licence (eupl) 1.0": "EUPL-1.0",
  "european union public licence (eupl)": "EUPL",
  "gnu general public license v3.0": "GPL-3.0",
  "gnu general public license v2.0": "GPL-2.0",
  "gnu affero general public license v3.0": "AGPL-3.0",
  "gnu lesser general public license v3.0": "LGPL-3.0",
  "gnu lesser general public license v2.1": "LGPL-2.1",
};

/** SPDX identifiers recognised with their canonical casing, keyed lower-case. */
const KNOWN_SPDX_IDS: Record<string, string> = Object.fromEntries(
  [
    "0BSD",
    "AGPL-3.0",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC0-1.0",
    "CC-BY-4.0",
    "CC-BY-SA-4.0",
    "EUPL-1.0",
    "EUPL-1.1",
    "EUPL-1.2",
    "GPL-2.0",
    "GPL-3.0",
    "ISC",
    "LGPL-2.1",
    "LGPL-3.0",
    "MIT",
    "MPL-2.0",
    "Unlicense",
  ].map((id) => [id.toLowerCase(), id])
);

const VARIANT_SUFFIX = /-(only|or-later)$/i;
const SPDX_TOKEN = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
const OPERATOR = /^(OR|AND|WITH)$/i;

export interface LicenceDeclaration {
  /** File the declaration was read from, e.g. `composer.json`. */
  source: string;
  /** The value as written. */
  raw: string;
  /** Normalised SPDX identifier or expression, or null when not recognised. */
  spdx: string | null;
}

function normaliseToken(token: string): string | null {
  const key = token.toLowerCase();
  if (key in LICENCE_ALIASES) return LICENCE_ALIASES[key];
  if (!SPDX_TOKEN.test(token)) return null;

  let base = token;
  let suffix = "";
  const variant = token.match(VARIANT_SUFFIX);
  if (variant) {
    base = token.slice(0, -variant[0].length);
    suffix = variant[1].toLowerCase() === "only" ? "-only" : "-or-later";
  } else if (token.endsWith("+")) {
    base = token.slice(0, -1);
    suffix = "-or-later";
  }
  const canonicalBase =
    KNOWN_SPDX_IDS[base.toLowerCase()] ?? LICENCE_ALIASES[base.toLowerCase()] ?? base;
  return `${canonicalBase}${suffix}`;
}

/**
 * Normalises a declared licence to its SPDX form, case-insensitively.
 * Supports single identifiers, the aliases in LICENCE_ALIASES and simple
 * `OR`/`AND`/`WITH` expressions. Returns null for values that are not a
 * recognisable licence, such as `SEE LICENSE IN LICENSE`.
 */
export function normaliseLicence(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return null;

  const whole = LICENCE_ALIASES[value.toLowerCase()];
  if (whole) return whole;

  const parts = value.replace(/[()]/g, " ").trim().split(" ");
  if (parts.length === 1) return normaliseToken(parts[0]);
  if (parts.length % 2 === 0) return null;

  const normalised: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      if (!OPERATOR.test(parts[i])) return null;
      normalised.push(parts[i].toUpperCase());
    } else {
      const token = normaliseToken(parts[i]);
      if (!token) return null;
      normalised.push(token);
    }
  }
  return normalised.join(" ");
}

export type LicenceComparison = "same" | "variant" | "different";

/** Splits an expression into tokens; operands of a pure `OR` expression are sorted, since their order carries no meaning. */
function tokens(expression: string): string[] {
  const parts = expression.split(" ");
  const operators = parts.filter((_, i) => i % 2 === 1);
  if (operators.length === 0 || operators.some((operator) => operator !== "OR")) return parts;
  const operands = parts.filter((_, i) => i % 2 === 0).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return operands.flatMap((operand, i) => (i === 0 ? [operand] : ["OR", operand]));
}

function stripVariant(token: string): string {
  return token.replace(VARIANT_SUFFIX, "");
}

function isFamily(token: string): boolean {
  return !/\d/.test(token);
}

function compareTokens(a: string, b: string): LicenceComparison {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return "same";
  const baseA = stripVariant(la);
  const baseB = stripVariant(lb);
  if (baseA === baseB) {
    return VARIANT_SUFFIX.test(la) && VARIANT_SUFFIX.test(lb) ? "variant" : "same";
  }
  if (isFamily(la) && baseB.startsWith(`${la}-`)) return "same";
  if (isFamily(lb) && baseA.startsWith(`${lb}-`)) return "same";
  return "different";
}

/**
 * Compares two normalised licences. `variant` means they differ only in
 * `-only` versus `-or-later`. A declaration that omits the version or the
 * variant (for example `AGPL` or the deprecated `GPL-3.0`) agrees with any
 * more specific declaration of the same licence.
 */
export function compareLicences(a: string, b: string): LicenceComparison {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length !== tb.length) return "different";
  let result: LicenceComparison = "same";
  for (let i = 0; i < ta.length; i++) {
    if (i % 2 === 1) {
      if (ta[i] !== tb[i]) return "different";
      continue;
    }
    const comparison = compareTokens(ta[i], tb[i]);
    if (comparison === "different") return "different";
    if (comparison === "variant") result = "variant";
  }
  return result;
}

export function parsePackageJsonLicence(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const licence = parsed.license;
    if (typeof licence === "string") return licence;
    if (licence && typeof licence === "object" && typeof (licence as { type?: unknown }).type === "string") {
      return (licence as { type: string }).type;
    }
    if (Array.isArray(parsed.licenses)) {
      const types = parsed.licenses
        .map((entry) => (entry && typeof entry === "object" ? (entry as { type?: unknown }).type : null))
        .filter((type): type is string => typeof type === "string");
      if (types.length > 0) return types.join(" OR ");
    }
  } catch {
    return null;
  }
  return null;
}

/** Reads composer.json `license`; an array is a disjunction (`OR`) per the Composer schema. */
export function parseComposerJsonLicence(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const licence = parsed.license;
    if (typeof licence === "string") return licence;
    if (Array.isArray(licence)) {
      const values = licence.filter((value): value is string => typeof value === "string");
      if (values.length === 0) return null;
      return values.join(" OR ");
    }
  } catch {
    return null;
  }
  return null;
}

export function parsePubliccodeLicence(content: string): string | null {
  try {
    const parsed = yaml.load(content) as { legal?: { license?: unknown } } | null;
    const licence = parsed?.legal?.license;
    return typeof licence === "string" ? licence : null;
  } catch {
    return null;
  }
}

function unquote(value: string): string | null {
  const match = value.trim().match(/^(["'])(.*)\1/);
  return match ? match[2] : null;
}

/**
 * Reads `license` from the first of the given TOML tables. Handles
 * `license = "MIT"` and the inline table `license = { text = "MIT" }`; a
 * `{ file = ... }` reference has no identifier and yields null.
 */
export function parseTomlLicence(content: string, tables: string[]): string | null {
  const values = new Map<string, string>();
  let table = "";
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = line.match(/^\[([^\[\]]+)\]$/);
    if (header) {
      table = header[1].trim();
      continue;
    }
    if (!tables.includes(table) || values.has(table)) continue;
    const assignment = line.match(/^license\s*=\s*(.+)$/);
    if (!assignment) continue;
    const value = assignment[1].trim();
    if (value.startsWith("{")) {
      const text = value.match(/\btext\s*=\s*(["'][^"']*["'])/);
      const parsed = text ? unquote(text[1]) : null;
      if (parsed) values.set(table, parsed);
    } else {
      const parsed = unquote(value);
      if (parsed) values.set(table, parsed);
    }
  }
  for (const name of tables) {
    const value = values.get(name);
    if (value) return value;
  }
  return null;
}

export function parsePyprojectLicence(content: string): string | null {
  return parseTomlLicence(content, ["project", "tool.poetry"]);
}

export function parseCargoTomlLicence(content: string): string | null {
  return parseTomlLicence(content, ["package"]);
}

export function parseSetupCfgLicence(content: string): string | null {
  let section = "";
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      section = header[1].trim();
      continue;
    }
    if (section !== "metadata") continue;
    const assignment = line.match(/^license\s*[=:]\s*(.+)$/);
    if (assignment) return assignment[1].trim();
  }
  return null;
}

/** Reads every `<licence>` element of a Nextcloud appinfo/info.xml; several elements form a disjunction. */
export function parseAppInfoLicence(content: string): string | null {
  const values = [...content.matchAll(/<licen[cs]e>\s*([^<]+?)\s*<\/licen[cs]e>/gi)].map(
    (match) => match[1]
  );
  if (values.length === 0) return null;
  return values.join(" OR ");
}

/**
 * Normalises the licence detected from a LICENSE file's text. A bare GNU
 * family name is not compared, because the full AGPL and LGPL texts also
 * mention the GNU General Public License.
 */
export function licenceFromLicenseText(content: string): string | null {
  const detected = detectLicenseFromText(content);
  if (!detected) return null;
  return LICENCE_ALIASES[detected.toLowerCase()] ?? null;
}

const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt|rst))?$/i;

type ManifestParser = (content: string) => string | null;

const MANIFESTS: Array<{ file: string; parse: ManifestParser }> = [
  { file: "package.json", parse: parsePackageJsonLicence },
  { file: "composer.json", parse: parseComposerJsonLicence },
  { file: "publiccode.yml", parse: parsePubliccodeLicence },
  { file: "publiccode.yaml", parse: parsePubliccodeLicence },
  { file: "pyproject.toml", parse: parsePyprojectLicence },
  { file: "Cargo.toml", parse: parseCargoTomlLicence },
  { file: "setup.cfg", parse: parseSetupCfgLicence },
  { file: "appinfo/info.xml", parse: parseAppInfoLicence },
];

function describeDeclaration(declaration: LicenceDeclaration): string {
  if (!declaration.spdx) return `${declaration.source}: ${declaration.raw} (not recognised, not compared)`;
  return `${declaration.source}: ${declaration.spdx}`;
}

/** Decides the check result from the collected declarations. */
export function evaluateLicenceDeclarations(declarations: LicenceDeclaration[]): CheckResult {
  const evidence = declarations.map(describeDeclaration);
  const compared = declarations.filter(
    (declaration): declaration is LicenceDeclaration & { spdx: string } => declaration.spdx !== null
  );
  const base = {
    id: "licenceconsistency",
    title: TITLE,
    description: DESCRIPTION,
    evidence,
    referenceUrl: REFERENCE_URL,
  };

  if (compared.length === 0) {
    return {
      ...base,
      status: "warn",
      message:
        declarations.length === 0
          ? "No licence declaration found in the LICENSE file or any manifest; nothing to compare."
          : "No recognisable licence declaration found; nothing to compare.",
    };
  }

  if (compared.length === 1) {
    return {
      ...base,
      status: "warn",
      message: `Only one licence declaration found (${describeDeclaration(compared[0])}); nothing to compare it with. Declare the licence in the package manifest and publiccode.yml as well.`,
    };
  }

  const groups: Array<Array<LicenceDeclaration & { spdx: string }>> = [];
  for (const declaration of compared) {
    const group = groups.find((candidate) => compareLicences(candidate[0].spdx, declaration.spdx) !== "different");
    if (group) group.push(declaration);
    else groups.push([declaration]);
  }
  const reference = compared.reduce((best, declaration) =>
    declaration.spdx.length > best.spdx.length ? declaration : best
  );

  if (groups.length > 1) {
    const named = groups
      .map((group) => `${group[0].spdx} (${group.map((declaration) => declaration.source).join(", ")})`)
      .join(" versus ");
    return {
      ...base,
      status: "fail",
      message: `Licence declarations disagree: ${named}.`,
    };
  }

  const variants: string[] = [];
  for (let i = 0; i < compared.length; i++) {
    for (let j = i + 1; j < compared.length; j++) {
      if (compareLicences(compared[i].spdx, compared[j].spdx) === "variant") {
        variants.push(`${compared[i].source} says ${compared[i].spdx}, ${compared[j].source} says ${compared[j].spdx}`);
      }
    }
  }

  if (variants.length > 0) {
    return {
      ...base,
      status: "warn",
      message: `Licence declarations name the same licence but differ in -only versus -or-later: ${variants.join("; ")}.`,
    };
  }

  return {
    ...base,
    status: "pass",
    message: `All ${compared.length} licence declarations agree (${reference.spdx}).`,
  };
}

/** Collects licence declarations from the repository root and appinfo/info.xml. */
export async function collectLicenceDeclarations(
  context: RepoContext,
  tree: string[]
): Promise<LicenceDeclaration[]> {
  const declarations: LicenceDeclaration[] = [];

  const licenseFile = tree.find((file) => LICENSE_FILE.test(file));
  if (licenseFile) {
    const content = await context.provider.getFileContent(context, licenseFile);
    if (content) {
      const detected = detectLicenseFromText(content);
      if (detected) {
        declarations.push({
          source: licenseFile,
          raw: detected,
          spdx: licenceFromLicenseText(content),
        });
      }
    }
  }

  for (const manifest of MANIFESTS) {
    const file = tree.find((path) => path.toLowerCase() === manifest.file.toLowerCase());
    if (!file) continue;
    const content = await context.provider.getFileContent(context, file);
    if (!content) continue;
    const raw = manifest.parse(content);
    if (!raw) continue;
    declarations.push({ source: file, raw, spdx: normaliseLicence(raw) });
  }

  return declarations;
}

export async function checkLicenceConsistency(
  context: RepoContext,
  tree: string[]
): Promise<CheckResult> {
  const declarations = await collectLicenceDeclarations(context, tree);
  return evaluateLicenceDeclarations(declarations);
}
