import type { MaintenanceDrop } from "@/generated/openapi-client";

/** How many recovered drops the card lists. */
const RECOVERED_SHOWN = 5;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("nl-NL");
}

/** "pass to fail", "4 to 3 stars" or "suitable to not suitable". */
export function dropChange(drop: Pick<MaintenanceDrop, "kind" | "from" | "to">): string {
  return drop.kind === "rating" ? `${drop.from} to ${drop.to} stars` : `${drop.from} to ${drop.to}`;
}

/** Open drops first, overdue before the rest, then by fix-by date. */
function byUrgency(a: MaintenanceDrop, b: MaintenanceDrop): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return a.fixBy.localeCompare(b.fixBy);
}

/**
 * What got worse since an earlier run, with the date a maintainer has to
 * fix it by. A drop is recovered when a later run passes again.
 */
export default function DropsCard({ drops }: { drops: MaintenanceDrop[] }) {
  const open = drops.filter((drop) => drop.resolvedAt === null).sort(byUrgency);
  const recovered = drops.filter((drop) => drop.resolvedAt !== null).slice(0, RECOVERED_SHOWN);
  const overdue = open.filter((drop) => drop.overdue).length;

  return (
    <section aria-labelledby="drops-heading" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 id="drops-heading" className="text-lg font-semibold text-gray-800">
          Drops to fix
        </h3>
        <span className="text-sm text-gray-600">
          {open.length} open{overdue > 0 ? `, ${overdue} overdue` : ""}
        </span>
      </div>
      <p className="text-xs text-gray-600">
        A drop is a criterion that went from pass to fail, a rating that lost a star, or the lost verdict, compared with
        the previous run of the same kind of version. The fix terms are proposals until a governance decision sets them.
      </p>

      {open.length === 0 ? (
        <p className="text-sm text-gray-600">No open drops.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {open.map((drop) => (
            <li key={drop.id} className="py-2 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-800">{drop.label}</p>
                <p className="text-xs text-gray-600">
                  {dropChange(drop)}, found {formatDate(drop.detectedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-700">
                  Fix by {formatDate(drop.fixBy)} ({drop.fixTermDays} days)
                </span>
                {drop.overdue && (
                  <span className="inline-flex font-semibold px-2 py-0.5 rounded-full border border-red-300 text-red-800 bg-red-50">
                    Overdue
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {recovered.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-700">Recently recovered ({recovered.length})</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
            {recovered.map((drop) => (
              <li key={drop.id}>
                {drop.label}: {dropChange(drop)}, found {formatDate(drop.detectedAt)}, recovered{" "}
                {formatDate(drop.resolvedAt as string)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
