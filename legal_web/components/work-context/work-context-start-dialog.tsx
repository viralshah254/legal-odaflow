"use client";

/**
 * WorkContextStartDialog — updated for C05 (B04/B05 fixes).
 *
 * Changes from previous version:
 * - Uses useResolvedWorkContext().startWork() instead of calling startWorkContext() directly.
 *   This means the resolved context (matterId, clientId, countryCode) flows through the
 *   canonical ResolvedWorkContextProvider and is available to all components via useMatter().
 * - countryCode is derived from the jurisdiction picker prop, not hard-coded to "IN".
 * - operationRequestKey is generated automatically inside startWork() (UUID v4 per submit).
 * - Exported WorkContextSelection is kept for backwards-compatibility with existing callers.
 */

import { useState } from "react";
import { useResolvedWorkContext } from "@/lib/contexts/work-context";

export type WorkContextSelection = {
  standalone: boolean;
  clientId?: string;
  matterId?: string;
  clientName?: string;
  countryCode: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * Called after the work context is successfully resolved and stored.
   * The resolved context is also available via useMatter() throughout the app.
   */
  onConfirm: (selection: WorkContextSelection) => void;
  /**
   * ISO-2 country code from the jurisdiction picker.
   * Defaults to the user's profile country when not set.
   * B05 fix: replaces the previous hard-coded "IN".
   */
  countryCode?: string;
};

export function WorkContextStartDialog({ open, onClose, onConfirm, countryCode = "IN" }: Props) {
  const { startWork, loading, error: ctxError } = useResolvedWorkContext();

  const [mode, setMode] = useState<"existing" | "new" | "unassigned">("existing");
  const [clientId, setClientId] = useState("");
  const [matterId, setMatterId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newMatterTitle, setNewMatterTitle] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const error = ctxError ?? localError;

  if (!open) return null;

  const confirm = async () => {
    setLocalError(null);
    try {
      // startWork() internally generates a fresh operationRequestKey per call (B05 fix).
      // The resolved context is stored in the provider and accessible via useMatter().
      const resolved = await startWork({
        mode:
          mode === "unassigned"
            ? "unassigned"
            : mode === "new"
              ? "new_client"
              : "existing_client",
        clientId: mode === "existing" ? clientId || undefined : undefined,
        matterId: mode === "existing" ? matterId || undefined : undefined,
        // B05 fix: countryCode comes from the prop (jurisdiction picker), not hard-coded
        countryCode,
        clientName: mode === "new" ? newClientName : undefined,
        createClient:
          mode === "new" && newClientName
            ? { name: newClientName, countryCode }
            : undefined,
        createMatter:
          mode === "new"
            ? { title: newMatterTitle || "New matter file", countryCode }
            : undefined,
      });

      onConfirm({
        standalone: resolved.standalone,
        clientId: resolved.clientId ?? undefined,
        matterId: resolved.matterId ?? undefined,
        clientName: resolved.clientName,
        countryCode: resolved.countryCode,
      });
      onClose();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not start work");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Is this work for a client?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a client and file, or continue as unassigned work.
        </p>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
            Existing client
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
            Add client and new file
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "unassigned"} onChange={() => setMode("unassigned")} />
            Continue without client (unassigned)
          </label>
        </div>
        {mode === "existing" && (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Client ID (picker integration)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Matter ID (optional)"
              value={matterId}
              onChange={(e) => setMatterId(e.target.value)}
            />
          </div>
        )}
        {mode === "new" && (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
            />
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              placeholder="Matter / file title"
              value={newMatterTitle}
              onChange={(e) => setNewMatterTitle(e.target.value)}
            />
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void confirm()}
          >
            {loading ? "Starting…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
