"use client";

import { useState } from "react";
import { startWorkContext } from "@/lib/api/work-context";

export type WorkContextSelection = {
  standalone: boolean;
  clientId?: string;
  matterId?: string;
  clientName?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: WorkContextSelection) => void;
};

export function WorkContextStartDialog({ open, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<"existing" | "new" | "unassigned">("existing");
  const [clientId, setClientId] = useState("");
  const [matterId, setMatterId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newMatterTitle, setNewMatterTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await startWorkContext({
        mode:
          mode === "unassigned"
            ? "unassigned"
            : mode === "new"
              ? "new_client"
              : "existing_client",
        clientId: mode === "existing" ? clientId : undefined,
        matterId: mode === "existing" ? matterId || undefined : undefined,
        createClient:
          mode === "new"
            ? { name: newClientName, countryCode: "IN" }
            : undefined,
        createMatter:
          mode === "new"
            ? { title: newMatterTitle || "New matter file", countryCode: "IN" }
            : undefined,
      });
      onConfirm({
        standalone: result.standalone,
        clientId: result.clientId ?? undefined,
        matterId: result.matterId ?? undefined,
        clientName: mode === "new" ? newClientName : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start work");
    } finally {
      setBusy(false);
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
            disabled={busy}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
            onClick={() => void confirm()}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
