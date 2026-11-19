"use client";

import { useId, useState } from "react";
import ApprovalLevel from "@/components/ApprovalLevel";
import {
  deleteSla,
  deleteUserConfirmation,
  postSla,
  postUserConfirmation,
  type UsageStatus,
} from "@/lib/apiClient";
import type { UserConfirmationInput } from "@/generated/openapi-client";
import { computeApproval } from "@/lib/approval";
import type { Endorsement } from "@/lib/types";

interface ApprovalSectionProps {
  repoId: string;
  endorsement: Endorsement;
  /** The usage status from the backend, or null when it could not be loaded */
  initialUsage: UsageStatus | null;
  minConfirmedUsers: number;
  /** Today as YYYY-MM-DD */
  today: string;
}

const METHOD_LABELS: Record<string, string> = {
  "written-confirmation": "Written confirmation",
  "register-entry": "Register entry",
};

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
  const confirmed = usage.confirmedUserCount ?? null;
  if (declared === null || confirmed === null) {
    return "The latest scan did not record the users in publiccode.yml. They are counted at the next scan.";
  }
  return `${declared} ${declared === 1 ? "organisation" : "organisations"} named under usedBy in publiccode.yml, ${confirmed} confirmed.`;
}

export default function ApprovalSection({
  repoId,
  endorsement,
  initialUsage,
  minConfirmedUsers,
  today,
}: ApprovalSectionProps) {
  const idPrefix = useId();
  const [usage, setUsage] = useState(initialUsage);
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState({
    organisation: "",
    confirmedOn: today,
    source: "",
    method: "written-confirmation",
  });
  const [sla, setSla] = useState({ party: "VNG", maintainer: "", startsOn: today, until: "", link: "" });

  const approval = computeApproval({
    endorsement,
    confirmedUserCount: usage ? usage.confirmedUserCount ?? null : null,
    slas: usage?.slas ?? [],
    minConfirmedUsers,
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

  async function addConfirmation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await run(
      () =>
        postUserConfirmation(
          repoId,
          { ...confirmation, method: confirmation.method as UserConfirmationInput.method },
          adminToken
        ),
      `Confirmation of ${confirmation.organisation.trim()} saved.`,
      "Saving the confirmation failed."
    );
    if (saved) setConfirmation({ ...confirmation, organisation: "", source: "" });
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
      <h3 className="text-lg font-semibold text-gray-800">Approval</h3>
      <ApprovalLevel approval={approval} endorsement={endorsement} minConfirmedUsers={minConfirmedUsers} />
      <p className="text-xs text-gray-500">
        The minimum of {minConfirmedUsers} confirmed users is a proposal: a component with one user is not yet a
        shared component. Who approves, and what happens when a maintainer misses the SLA, needs a governance decision.
        Usage counts only here. It never gives stars and never counts in a rating.
      </p>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Users</h4>
        <p className="text-sm text-gray-700">{usageSummary(usage)}</p>
        <p className="text-xs text-gray-500">
          An organisation counts as confirmed when it confirmed in writing that it uses the component, or a register
          lists it as a user. Names match the usedBy names, ignoring case and spaces at the ends.
        </p>
        {usage && usage.confirmations.length > 0 && (
          <ul aria-label="Confirmed users" className="text-sm text-gray-700 space-y-1">
            {usage.confirmations.map((item) => (
              <li key={item.id} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{item.organisation}</span>
                <span className="text-xs text-gray-500">
                  {METHOD_LABELS[item.method] ?? item.method}, {item.confirmedOn}
                </span>
                <a href={item.source} className="text-xs text-cg-lightblue hover:underline" rel="noreferrer" target="_blank">
                  source
                </a>
                {!item.declared && (
                  <span className="text-xs text-yellow-700">not named under usedBy, so not counted</span>
                )}
              </li>
            ))}
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

      <details className="border-t border-gray-200 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          Record confirmed users and SLAs (admin)
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

          <form onSubmit={addConfirmation} aria-label="Add a confirmed user" className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-800">Add a confirmed user</h5>
            <p className="text-xs text-gray-500">The organisation, date, method and source are shown on this page.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-organisation`} className={labelClass}>
                  Organisation
                </label>
                <input
                  id={`${idPrefix}-organisation`}
                  list={`${idPrefix}-declared`}
                  required
                  value={confirmation.organisation}
                  onChange={(event) => setConfirmation({ ...confirmation, organisation: event.target.value })}
                  className={inputClass}
                />
                <datalist id={`${idPrefix}-declared`}>
                  {declaredUsers.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-confirmed-on`} className={labelClass}>
                  Confirmed on
                </label>
                <input
                  id={`${idPrefix}-confirmed-on`}
                  type="date"
                  required
                  value={confirmation.confirmedOn}
                  onChange={(event) => setConfirmation({ ...confirmation, confirmedOn: event.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-method`} className={labelClass}>
                  Method
                </label>
                <select
                  id={`${idPrefix}-method`}
                  value={confirmation.method}
                  onChange={(event) => setConfirmation({ ...confirmation, method: event.target.value })}
                  className={inputClass}
                >
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor={`${idPrefix}-source`} className={labelClass}>
                  Source link
                </label>
                <input
                  id={`${idPrefix}-source`}
                  type="url"
                  required
                  value={confirmation.source}
                  onChange={(event) => setConfirmation({ ...confirmation, source: event.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-cg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cg-lightblue disabled:opacity-60"
            >
              Add confirmation
            </button>
          </form>

          {usage && usage.confirmations.length > 0 && (
            <ul aria-label="Remove a confirmation" className="space-y-1">
              {usage.confirmations.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => deleteUserConfirmation(repoId, item.id, adminToken),
                        `Confirmation of ${item.organisation} removed.`,
                        "Removing the confirmation failed."
                      )
                    }
                    className="text-sm text-red-700 hover:underline disabled:opacity-60"
                  >
                    Remove confirmation of {item.organisation}
                  </button>
                </li>
              ))}
            </ul>
          )}

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
                  value={sla.party}
                  onChange={(event) => setSla({ ...sla, party: event.target.value })}
                  className={inputClass}
                />
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
    </section>
  );
}
