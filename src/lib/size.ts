import type { SizeFamily, SizeLanguage, SizeMeasurement } from "./types";

/** The family of each language name scc reports for the files in scope. */
const FAMILY_BY_LANGUAGE: Record<string, SizeFamily> = {
  PHP: "php",
  Python: "python",
  JavaScript: "javascript",
  JSX: "javascript",
  TypeScript: "typescript",
  TSX: "typescript",
  "TypeScript Typings": "typescript",
  Vue: "vue",
  HTML: "html",
  "Django Template": "html",
  "Twig Template": "html",
  CSS: "css",
  Sass: "css",
  SCSS: "css",
  LESS: "css",
  SQL: "sql",
};

/** A factor of an effort model, and the published factor it borrows when the source has none for the family. */
export interface SizeFactor {
  value: number;
  /** The family whose published factor is used in place of one for this family */
  proxyOf?: SizeFamily;
}

/**
 * QSM Function Point Languages Table v5.0, average lines of code per function
 * point. It has rows for JavaScript, HTML and SQL only.
 */
export const QSM_LINES_PER_FUNCTION_POINT: Record<SizeFamily, SizeFactor> = {
  javascript: { value: 47 },
  html: { value: 34 },
  sql: { value: 21 },
  php: { value: 47, proxyOf: "javascript" },
  python: { value: 47, proxyOf: "javascript" },
  typescript: { value: 47, proxyOf: "javascript" },
  vue: { value: 47, proxyOf: "javascript" },
  css: { value: 34, proxyOf: "html" },
};

/**
 * ISBSG (2010), median project delivery rate in hours per function point:
 * scripting languages 7.6, HTML 13.7, SQL 11.4.
 */
export const ISBSG_HOURS_PER_FUNCTION_POINT: Record<SizeFamily, SizeFactor> = {
  javascript: { value: 7.6 },
  php: { value: 7.6 },
  python: { value: 7.6 },
  typescript: { value: 7.6 },
  vue: { value: 7.6 },
  html: { value: 13.7 },
  sql: { value: 11.4 },
  css: { value: 13.7, proxyOf: "html" },
};

/** Hours in a person-year: COCOMO II's 152 hours per person-month, times 12. */
export const HOURS_PER_PERSON_YEAR = 152 * 12;

/**
 * SIG/TÜV NORD CERT Guidance for Producers v17.0, section 3.1: the lines of
 * code in 3.9 person-years, as lines per person-year. PHP, Vue, HTML, CSS and
 * SQL have no published factor and use JavaScript's.
 */
export const SIG_V17_LINES_PER_PERSON_YEAR: Record<SizeFamily, SizeFactor> = {
  javascript: { value: 36300 / 3.9 },
  typescript: { value: 31600 / 3.9 },
  python: { value: 25000 / 3.9 },
  php: { value: 36300 / 3.9, proxyOf: "javascript" },
  vue: { value: 36300 / 3.9, proxyOf: "javascript" },
  html: { value: 36300 / 3.9, proxyOf: "javascript" },
  css: { value: 36300 / 3.9, proxyOf: "javascript" },
  sql: { value: 36300 / 3.9, proxyOf: "javascript" },
};

/** The v17.0 limit for 4 stars on volume, in person-years; v18 no longer rates volume. */
export const SIG_V17_FOUR_STAR_PERSON_YEARS = 3.9;

const FAMILY_BY_EXTENSION: Record<string, SizeFamily> = {
  php: "php",
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  vue: "vue",
  html: "html",
  htm: "html",
  twig: "html",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  sql: "sql",
};

export function sizeFamily(language: string, extension?: string): SizeFamily | null {
  return FAMILY_BY_LANGUAGE[language] ?? (extension ? FAMILY_BY_EXTENSION[extension.toLowerCase()] : undefined) ?? null;
}

/** The part of scc's `--by-file --format json` output that is read. */
export interface SccLanguage {
  Name: string;
  Files: Array<{ Location: string; Extension?: string; Code: number }>;
}

function normalisePath(location: string): string {
  return location.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Lines of code per language over the files in scope, largest first. */
export function sizeFromScc(scc: SccLanguage[], scope: Iterable<string>, tool: string): SizeMeasurement {
  const inScope = new Set(Array.from(scope, normalisePath));
  const languages: SizeLanguage[] = [];
  for (const language of scc) {
    const files = language.Files.filter((file) => inScope.has(normalisePath(file.Location)));
    if (files.length === 0) continue;
    languages.push({
      language: language.Name,
      family: sizeFamily(language.Name, files[0].Extension),
      files: files.length,
      loc: files.reduce((sum, file) => sum + file.Code, 0),
    });
  }
  languages.sort((a, b) => b.loc - a.loc || a.language.localeCompare(b.language));
  return {
    tool,
    files: languages.reduce((sum, language) => sum + language.files, 0),
    loc: languages.reduce((sum, language) => sum + language.loc, 0),
    languages,
  };
}

export interface SizeEstimates {
  /** Open track: backfiring with QSM lines per function point and ISBSG hours per function point */
  functionPoints: number;
  rebuildPersonYears: number;
  /** Estimate track: lines divided by SIG v17.0 lines per person-year, as context only */
  sigStylePersonYears: number;
  /** Lines in a language neither model has a factor for, left out of both */
  unmodelledLoc: number;
  /** Families that borrow another family's factor, per model; in backfiring the hours follow the lines */
  backfiringProxies: SizeFamily[];
  sigStyleProxies: SizeFamily[];
}

function proxiesIn(languages: SizeLanguage[], factors: Record<SizeFamily, SizeFactor>): SizeFamily[] {
  const families = new Set<SizeFamily>();
  for (const language of languages) {
    if (language.family && language.loc > 0 && factors[language.family].proxyOf) families.add(language.family);
  }
  return [...families];
}

/** Both effort figures from the measured lines per language. */
export function sizeEstimates(size: SizeMeasurement): SizeEstimates {
  let functionPoints = 0;
  let hours = 0;
  let sigStylePersonYears = 0;
  let unmodelledLoc = 0;
  for (const { family, loc } of size.languages) {
    if (!family) {
      unmodelledLoc += loc;
      continue;
    }
    const points = loc / QSM_LINES_PER_FUNCTION_POINT[family].value;
    functionPoints += points;
    hours += points * ISBSG_HOURS_PER_FUNCTION_POINT[family].value;
    sigStylePersonYears += loc / SIG_V17_LINES_PER_PERSON_YEAR[family].value;
  }
  return {
    functionPoints,
    rebuildPersonYears: hours / HOURS_PER_PERSON_YEAR,
    sigStylePersonYears,
    unmodelledLoc,
    backfiringProxies: proxiesIn(size.languages, QSM_LINES_PER_FUNCTION_POINT),
    sigStyleProxies: proxiesIn(size.languages, SIG_V17_LINES_PER_PERSON_YEAR),
  };
}

export const FAMILY_LABELS: Record<SizeFamily, string> = {
  php: "PHP",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  vue: "Vue",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
};

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** "555,758 lines of code, not rated" */
export function sizeSummary(size: SizeMeasurement): string {
  return `${formatCount(size.loc)} lines of code, not rated`;
}

export function formatPersonYears(value: number): string {
  return `${value.toFixed(1)} person-years`;
}

/** "PHP and Vue use the JavaScript factor" for the families that borrow a factor in a model. */
export function proxyNote(proxies: SizeFamily[], factors: Record<SizeFamily, SizeFactor>): string | null {
  if (proxies.length === 0) return null;
  const byProxy = new Map<SizeFamily, SizeFamily[]>();
  for (const family of proxies) {
    const proxy = factors[family].proxyOf!;
    byProxy.set(proxy, [...(byProxy.get(proxy) ?? []), family]);
  }
  return [...byProxy]
    .map(([proxy, families]) => {
      const names = families.map((family) => FAMILY_LABELS[family]);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
      return `${list} ${families.length > 1 ? "use" : "uses"} the ${FAMILY_LABELS[proxy]} factor`;
    })
    .join("; ");
}

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === "object" && !Array.isArray(raw);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** The size of a stored check result; malformed language rows are left out. */
export function parseSize(raw: unknown): SizeMeasurement | undefined {
  if (!isPlainObject(raw) || typeof raw.tool !== "string" || !Array.isArray(raw.languages)) return undefined;
  const languages = raw.languages.flatMap((row): SizeLanguage[] => {
    if (!isPlainObject(row) || typeof row.language !== "string" || !isCount(row.files) || !isCount(row.loc)) return [];
    const family = typeof row.family === "string" && row.family in FAMILY_LABELS ? (row.family as SizeFamily) : null;
    return [{ language: row.language, family, files: row.files, loc: row.loc }];
  });
  return {
    tool: raw.tool,
    files: languages.reduce((sum, language) => sum + language.files, 0),
    loc: languages.reduce((sum, language) => sum + language.loc, 0),
    languages,
  };
}
