"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { putRepositoryRetire } from "@/lib/apiClient";

interface RetireControlProps {
  repoId: string;
  initialRetired: boolean;
  initialReason: string | null;
}

const REASON_MAX_LENGTH = 500;

function errorText(err: unknown): string {
  const status = (err as { status?: unknown }).status;
  const body = (err as { body?: { error?: unknown } }).body;
  if (status === 401) return "The admin token is not valid.";
  if (status === 503) return "Admin actions are disabled on the backend (ADMIN_TOKEN is not configured).";
  if (typeof body?.error === "string") return body.error;
  return err instanceof Error ? err.message : "Saving the retirement failed.";
}

/** Lets an admin retire a component with a reason, or undo it. A retired component keeps its history and is not rescanned. */
export default function RetireControl({ repoId, initialRetired, initialReason }: RetireControlProps) {
  const router = useRouter();
  const idPrefix = useId();
  const [retired, setRetired] = useState(initialRetired);
  const [reason, setReason] = useState(initialReason ?? "");
  const [adminToken, setAdminToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await putRepositoryRetire(
        repoId,
        retired ? { retired: true, reason: reason.trim() } : { retired: false },
        adminToken
      );
      setRetired(saved.retiredAt !== null);
      setReason(saved.retiredReason ?? "");
      setMessage({
        kind: "success",
        text: saved.retiredAt ? "Retired. It is no longer rescanned." : "No longer retired.",
      });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-xl border border-gray-200 px-4 py-3">
      <summary className="cursor-pointer min-h-[44px] flex items-center text-sm font-semibold text-gray-800">
        Retire this component (admin)
      </summary>
      <p className="mt-2 text-sm text-gray-600">
        A retired component keeps its history. It is not rescanned until you undo this.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-retired`}
            type="checkbox"
            checked={retired}
            onChange={(event) => setRetired(event.target.checked)}
            className="h-5 w-5"
          />
          <label htmlFor={`${idPrefix}-retired`} className="text-sm text-gray-800">
            Retired
          </label>
        </div>
        {retired && (
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-reason`} className="block text-sm font-medium text-gray-800">
              Reason
            </label>
            <textarea
              id={`${idPrefix}-reason`}
              required
              maxLength={REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
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
          className="min-h-[44px] rounded-lg bg-cg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-cg-lightblue disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <p role="status" className={`text-sm ${message?.kind === "error" ? "text-red-700" : "text-green-700"}`}>
          {message?.text ?? ""}
        </p>
      </form>
    </details>
  );
}
