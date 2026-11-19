import { STAR_LEVELS, type InformativeMetric, type MeasurementGroup, type MeasurementRow, type StarLevel, type StarRating } from "./types";

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === "object" && !Array.isArray(raw);
}

function parseThresholds(raw: unknown): Partial<Record<StarLevel, string>> {
  if (!isPlainObject(raw)) return {};
  const thresholds: Partial<Record<StarLevel, string>> = {};
  for (const level of STAR_LEVELS) {
    const value = raw[String(level)];
    if (typeof value === "string") thresholds[level] = value;
  }
  return thresholds;
}

function parseStars(raw: unknown): StarRating | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 5 ? (raw as StarRating) : null;
}

function parseRow(raw: unknown): MeasurementRow[] {
  if (!isPlainObject(raw) || typeof raw.label !== "string" || typeof raw.value !== "string") return [];
  return [
    {
      label: raw.label,
      value: raw.value,
      thresholds: parseThresholds(raw.thresholds),
      stars: parseStars(raw.stars),
      ...(typeof raw.starsText === "string" ? { starsText: raw.starsText } : {}),
    },
  ];
}

function parseGroup(raw: unknown): MeasurementGroup[] {
  if (!isPlainObject(raw) || typeof raw.id !== "string" || typeof raw.title !== "string") return [];
  const rows = Array.isArray(raw.rows) ? raw.rows.flatMap(parseRow) : [];
  if (rows.length === 0) return [];
  return [
    {
      id: raw.id,
      title: raw.title,
      aspects: Array.isArray(raw.aspects) ? raw.aspects.filter((key): key is string => typeof key === "string") : [],
      rows,
    },
  ];
}

/** The measurements of a stored check result; malformed groups and rows are left out. */
export function parseMeasurements(raw: unknown): MeasurementGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups = raw.flatMap(parseGroup);
  return groups.length > 0 ? groups : undefined;
}

function parseMetric(raw: unknown): InformativeMetric[] {
  if (!isPlainObject(raw)) return [];
  const { id, name, referenceUrl, value, explanation, target } = raw;
  if (typeof id !== "string" || typeof name !== "string" || typeof explanation !== "string") return [];
  if (typeof referenceUrl !== "string" || !/^https:\/\//.test(referenceUrl)) return [];
  if (value !== null && typeof value !== "string") return [];
  const kpi =
    isPlainObject(target) && typeof target.text === "string" && (typeof target.met === "boolean" || target.met === null)
      ? { target: { text: target.text, met: target.met } }
      : {};
  return [{ id, name, referenceUrl, value, explanation, ...kpi }];
}

/** The informative metrics of a stored check result; malformed metrics are left out. */
export function parseMetrics(raw: unknown): InformativeMetric[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const metrics = raw.flatMap(parseMetric);
  return metrics.length > 0 ? metrics : undefined;
}

/** The measurement groups of a check that count in one of its aspects. */
export function measurementsForAspect(groups: MeasurementGroup[] | undefined, aspectKey: string): MeasurementGroup[] {
  return (groups ?? []).filter((group) => group.aspects.includes(aspectKey));
}
