import type { KpiTarget } from "@/lib/maintenanceTerms";
import type { InformativeMetric } from "@/lib/types";

const HOURS: Record<string, number> = { minutes: 1 / 60, hours: 1, days: 24 };

/** The unit a KPI target of a metric is expressed in. */
const UNITS: Record<string, { one: string; many: string }> = {
  "contributor-absence-factor": { one: "person", many: "people" },
  "organizational-diversity": { one: "organisation", many: "organisations" },
  "change-request-closure-ratio": { one: "", many: "" },
  "time-to-first-response": { one: "hour", many: "hours" },
  "issue-response-time": { one: "hour", many: "hours" },
  "release-frequency": { one: "release in 12 months", many: "releases in 12 months" },
};

/**
 * The measured amount of a project health metric in the unit of its target,
 * read from the shown value: people, organisations, the closure ratio,
 * hours for response times, releases in 12 months. Null when it was not
 * measured or has no amount, such as "no response".
 */
export function metricAmount(metric: InformativeMetric): number | null {
  const value = metric.value;
  if (value === null) return null;
  switch (metric.id) {
    case "contributor-absence-factor":
    case "change-request-closure-ratio":
    case "organizational-diversity":
    case "release-frequency": {
      const match = /(\d+(?:\.\d+)?)/.exec(value);
      return match ? Number(match[1]) : null;
    }
    case "time-to-first-response":
    case "issue-response-time": {
      const match = /(\d+(?:\.\d+)?) (minutes|hours|days)/.exec(value);
      return match ? Number(match[1]) * HOURS[match[2]] : null;
    }
    default:
      return null;
  }
}

function amountText(metricId: string, amount: number): string {
  const unit = UNITS[metricId];
  const name = unit ? (amount === 1 ? unit.one : unit.many) : "";
  return name ? `${amount} ${name}` : String(amount);
}

/** "at least 2 people", "at most 48 hours", or both. */
export function targetText(metricId: string, target: KpiTarget): string {
  const parts = [
    ...(target.min !== undefined ? [`at least ${amountText(metricId, target.min)}`] : []),
    ...(target.max !== undefined ? [`at most ${amountText(metricId, target.max)}`] : []),
  ];
  return parts.join(" and ");
}

/**
 * Whether a metric meets its target. "No response" misses a target on a
 * response time; any other value without an amount is not compared.
 */
export function meetsTarget(metric: InformativeMetric, target: KpiTarget): boolean | null {
  if (metric.value === "no response" && target.max !== undefined) return false;
  const amount = metricAmount(metric);
  if (amount === null) return null;
  if (target.min !== undefined && amount < target.min) return false;
  if (target.max !== undefined && amount > target.max) return false;
  return true;
}

/** The metrics with their target and whether they meet it, for the metrics that have a target. */
export function withKpiTargets(metrics: InformativeMetric[], targets: Record<string, KpiTarget>): InformativeMetric[] {
  return metrics.map((metric) => {
    const target = targets[metric.id];
    if (!target || (target.min === undefined && target.max === undefined)) return metric;
    return { ...metric, target: { text: targetText(metric.id, target), met: meetsTarget(metric, target) } };
  });
}
