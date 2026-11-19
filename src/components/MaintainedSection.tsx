"use client";

import Link from "next/link";
import { useId, useState } from "react";
import MaintainedLevel from "@/components/MaintainedLevel";
import { deleteSla, postSla, type UsageStatus } from "@/lib/apiClient";
import { STATIC_SITE_LINKS } from "@/lib/dataSource/mode";
import { computeMaintained, organisationsLabel } from "@/lib/maintained";
import { organisationHref, organisationKey } from "@/lib/organisations";
import type { Endorsement } from "@/lib/types";

interface MaintainedSectionProps {
  repoId: string;
  endorsement: Endorsement;
  /** `developmentStatus` of the latest scanned publiccode.yml, or null */
  developmentStatus: string | null;
  /** The usage status from the backend, or null when it could not be loaded */
  initialUsage: UsageStatus | null;
  minUsers: number;
  /** Today as YYYY-MM-DD */
  today: string;
  /** Slugs of the organisation pages by organisation key; a declared name without one is shown without a link */
  organisationSlugs?: Record<string, string>;
  /** Without the admin form, for the static site where SLAs change by pull request */
  readOnly?: boolean;
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const labelClass = "block text-sm font-medium text-gray-800";

function errorText(err: unknown, fallback: string): string {
  const status = (err as { status?: unknown }).status;
  const body = (err as { body?: { error?: unknown } }).body;
  if (status === 401) return "The admin token is not valid.";
  if (status === 503) return "Admin actions are disabled on the backend (ADMIN_TOKEN is not configured).";
  if (typeof body?.error === "string") return body.error;
  return err instanceof Error ? err.message : fallback;
}

function usageSummary(usage: UsageStatus | null): string {
  if (!usage) return "Usage could not be loaded from the backend.";
  const declared = usage.declaredUserCount ?? null;
  if (declared === null) {
    return "The latest scan did not record the users in publiccode.yml. They are counted at the next scan.";
  }
  return `${declared} ${declared === 1 ? "organisation" : "organisations"} named under usedBy in publiccode.yml.`;
}

export default function MaintainedSection({
  repoId,
  endorsement,
  developmentStatus,
  initialUsage,
  minUsers,
  today,
  organisationSlugs = {},
  readOnly = false,
}: MaintainedSectionProps) {
  const idPrefix = useId();
  const [usage, setUsage] = useState(initialUsage);
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [sla, setSla] = useState({ party: "", maintainer: "", startsOn: today, until: "", link: "" });

  const level = computeMaintained({
    endorsement,
    developmentStatus,
    declaredUserCount: usage ? usage.declaredUserCount ?? null : null,
    slas: usage?.slas ?? [],
    minUsers,
    today,
  });

  async function run(action: () => Promise<UsageStatus>, success: string, fallback: string) {
    setBusy(true);
    setMessage(null);
    try {
      setUsage(await action());
      setMessage({ kind: "success", text: success });
      return true;
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err, fallback) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSla(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await run(
      () => postSla(repoId, { ...sla, link: sla.link.trim() || undefined }, adminToken),
      "SLA saved.",
      "Saving the SLA failed."
    );
    if (saved) setSla({ ...sla, maintainer: "", until: "", link: "" });
  }

  const declaredUsers = usage?.declaredUsers ?? [];

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Level</h3>
      <MaintainedLevel level={level} endorsement={endorsement} minUsers={minUsers} />
      <p className="text-xs text-gray-500">
        The minimum of {organisationsLabel(minUsers)} declared in publiccode.yml follows the Common Ground standard put
        to the VNG ALV: a component is proven in practice by one or more municipalities. Who decides that a component is Maintained, and what happens when a maintainer misses the SLA,
        needs a governance decision.
        Usage counts only here. It never gives stars and never counts in a rating.
      </p>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Users</h4>
        <p className="text-sm text-gray-700">{usageSummary(usage)}</p>
        <p className="text-xs text-gray-500">
          The organisations the maintainers name under usedBy in the scanned publiccode.yml. They are self-declared
          and not verified. A name counts once, ignoring case and spaces at the ends.
        </p>
        {declaredUsers.length > 0 && (
          <ul aria-label="Declared users" className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
            {declaredUsers.map((name) => {
              const slug = organisationSlugs[organisationKey(name)];
              return (
                <li key={name}>
                  {slug ? (
                    <Link href={organisationHref(slug)} className="inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">SLA</h4>
        {!usage || usage.slas.length === 0 ? (
          <p className="text-sm text-gray-700">No SLA recorded.</p>
        ) : (
          <ul aria-label="SLAs" className="text-sm text-gray-700 space-y-1">
            {usage.slas.map((item) => (
              <li key={item.id} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {item.party} with {item.maintainer}
                </span>
                <span className="text-xs text-gray-500">
                  {item.startsOn} to {item.until}
                  {item.until < today ? ", expired" : ""}
                </span>
                {item.link && (
                  <a href={item.link} className="text-xs text-cg-lightblue hover:underline" rel="noreferrer" target="_blank">
                    link
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {readOnly ? (
        <p className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          SLAs are recorded in{" "}
          <a href={STATIC_SITE_LINKS.slaList} className="text-cg-lightblue hover:underline">
            config/slas.yml
          </a>{" "}
          and change by pull request.
        </p>
      ) : (
      <details className="border-t border-gray-200 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          Record SLAs (admin)
        </summary>
        <div className="mt-4 space-y-6">
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-token`} className={labelClass}>
              Admin token
            </label>
            <input
              id={`${idPrefix}-token`}
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              className={`${inputClass} max-w-md`}
            />
          </div>

          <form onSubmit={addSla} aria-label="Add an SLA" className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-800">Add an SLA</h5>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-party`} className={labelClass}>
                  Party
                </label>
                <input
                  id={`${idPrefix}-party`}
                  required
                  aria-describedby={`${idPrefix}-party-help`}
                  value={sla.party}
                  onChange={(event) => setSla({ ...sla, party: event.target.value })}
                  className={inputClass}
                />
                <p id={`${idPrefix}-party-help`} className="text-xs text-gray-500">
                  Who contracts the maintainer, usually a municipality, on the VNG model contract.
                </p>
              </div>
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-maintainer`} className={labelClass}>
                  Maintainer
                </label>
                <input
                  id={`${idPrefix}-maintainer`}
                  required
                  value={sla.maintainer}
                  onChange={(event) => setSla({ ...sla, maintainer: event.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-starts-on`} className={labelClass}>
                  Start
                </label>
                <input
                  id={`${idPrefix}-starts-on`}
                  type="date"
                  required
                  value={sla.startsOn}
                  onChange={(event) => setSla({ ...sla, startsOn: event.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-until`} className={labelClass}>
                  Until
                </label>
                <input
                  id={`${idPrefix}-until`}
                  type="date"
                  required
                  value={sla.until}
                  onChange={(event) => setSla({ ...sla, until: event.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`${idPrefix}-link`} className={labelClass}>
                  Link (optional)
                </label>
                <input
                  id={`${idPrefix}-link`}
                  type="url"
                  value={sla.link}
                  onChange={(event) => setSla({ ...sla, link: event.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-cg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cg-lightblue disabled:opacity-60"
            >
              Add SLA
            </button>
          </form>

          {usage && usage.slas.length > 0 && (
            <ul aria-label="Remove an SLA" className="space-y-1">
              {usage.slas.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => deleteSla(repoId, item.id, adminToken),
                        "SLA removed.",
                        "Removing the SLA failed."
                      )
                    }
                    className="text-sm text-red-700 hover:underline disabled:opacity-60"
                  >
                    Remove SLA of {item.party} with {item.maintainer} until {item.until}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p role="status" className={`text-sm ${message?.kind === "error" ? "text-red-700" : "text-green-700"}`}>
            {message?.text ?? ""}
          </p>
        </div>
      </details>
      )}
    </section>
  );
}
