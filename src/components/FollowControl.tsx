"use client";

import { useId, useState } from "react";
import { putRepositoryFollow } from "@/lib/apiClient";

export const CHECK_INTERVAL_OPTIONS = [
  { hours: 24, label: "Daily" },
  { hours: 168, label: "Weekly" },
  { hours: 720, label: "Monthly" },
] as const;

const DEFAULT_INTERVAL_HOURS = 168;

interface FollowControlProps {
  repoId: string;
  initialFollowed: boolean;
  initialCheckIntervalHours: number | null;
  initialNextCheckAt: string | null;
}

export function formatNextCheck(nextCheckAt: string | null): string {
  return nextCheckAt ? new Date(nextCheckAt).toLocaleString("nl-NL") : "not scheduled";
}

export default function FollowControl({
  repoId,
  initialFollowed,
  initialCheckIntervalHours,
  initialNextCheckAt,
}: FollowControlProps) {
  const idPrefix = useId();
  const [followed, setFollowed] = useState(initialFollowed);
  const [intervalHours, setIntervalHours] = useState(
    initialCheckIntervalHours ?? DEFAULT_INTERVAL_HOURS
  );
  const [nextCheckAt, setNextCheckAt] = useState(initialNextCheckAt);
  const [adminToken, setAdminToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const saved = await putRepositoryFollow(
        repoId,
        { followed, checkIntervalHours: intervalHours },
        adminToken
      );
      setFollowed(saved.followed);
      setIntervalHours(saved.checkIntervalHours ?? DEFAULT_INTERVAL_HOURS);
      setNextCheckAt(saved.nextCheckAt);
      setMessage({
        kind: "success",
        text: saved.followed
          ? `Following. Next check: ${formatNextCheck(saved.nextCheckAt)}.`
          : "No longer following this repository.",
      });
    } catch (err) {
      const status = (err as { status?: unknown }).status;
      const text =
        status === 401
          ? "The admin token is not valid."
          : status === 503
          ? "Admin actions are disabled on the backend (ADMIN_TOKEN is not configured)."
          : err instanceof Error
          ? err.message
          : "Saving the follow setting failed.";
      setMessage({ kind: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <summary className="cursor-pointer text-lg font-semibold text-gray-800">
        Follow this repository (admin)
      </summary>
      <p className="mt-2 text-sm text-gray-600">
        A followed repository is rescanned automatically at the chosen interval.
        {" "}
        {nextCheckAt ? `Next check: ${formatNextCheck(nextCheckAt)}.` : "It is not followed now."}
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-followed`}
            type="checkbox"
            checked={followed}
            onChange={(event) => setFollowed(event.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor={`${idPrefix}-followed`} className="text-sm text-gray-800">
            Follow
          </label>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-interval`} className="block text-sm font-medium text-gray-800">
            Check interval
          </label>
          <select
            id={`${idPrefix}-interval`}
            value={intervalHours}
            onChange={(event) => setIntervalHours(Number(event.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {CHECK_INTERVAL_OPTIONS.map((option) => (
              <option key={option.hours} value={option.hours}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-token`} className="block text-sm font-medium text-gray-800">
            Admin token
          </label>
          <input
            id={`${idPrefix}-token`}
            type="password"
            autoComplete="off"
            required
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-cg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cg-lightblue disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <p
          role="status"
          className={`text-sm ${message?.kind === "error" ? "text-red-700" : "text-green-700"}`}
        >
          {message?.text ?? ""}
        </p>
      </form>
    </details>
  );
}
