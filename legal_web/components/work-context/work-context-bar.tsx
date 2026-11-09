"use client";

/**
 * WorkContextBar — shows the active work context (client / matter / jurisdiction)
 * and provides a control to start or change the work context.
 *
 * C13: integrates with ResolvedWorkContextProvider (C05) so that the jurisdiction
 * picker's countryCode flows into startWork() and all downstream requests
 * (research, draft, export) share the same context.
 */

import { useDetectedCountry } from "@/lib/contexts/country-context";
import { useState } from "react";
import { useResolvedWorkContext, useMatter } from "@/lib/contexts/work-context";
import { WorkContextStartDialog } from "./work-context-start-dialog";
import { cn } from "@/lib/utils";

type Props = {
  /**
   * ISO-2 country code from the jurisdiction picker (passed in by the parent page).
   * This is forwarded to WorkContextStartDialog so startWork() uses the real
   * jurisdiction, not a hard-coded default.
   */
  countryCode?: string;
  className?: string;
};

export function WorkContextBar({ countryCode: selectedCountry, className }: Props) {
  const { countryCode: workspaceCountry } = useDetectedCountry();
  const countryCode = selectedCountry || workspaceCountry;
  const { resolved, loading, clear } = useResolvedWorkContext();
  const { matterId, clientId } = useMatter();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Determine display label for the current context
  const contextLabel = resolved
    ? resolved.standalone
      ? "Unassigned work"
      : [resolved.clientName, matterId ? `Matter ${matterId.slice(0, 8)}…` : null]
          .filter(Boolean)
          .join(" / ") || `Client ${clientId?.slice(0, 8) ?? "—"}`
    : null;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 bg-muted/20 border-b border-border/50 text-sm",
          className,
        )}
      >
        {resolved ? (
          <>
            <span className="text-muted-foreground">Working on:</span>
            <span className="font-medium text-foreground">{contextLabel}</span>
            <span className="text-muted-foreground text-xs">
              ({resolved.countryCode})
            </span>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="ml-2 text-xs text-primary underline-offset-2 hover:underline"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              className="ml-1 text-xs text-muted-foreground hover:text-destructive"
              title="Clear work context"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              {loading ? "Starting…" : "No active work context"}
            </span>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={loading}
              className="ml-2 text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
            >
              Start work
            </button>
          </>
        )}
      </div>

      <WorkContextStartDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
        countryCode={countryCode}
      />
    </>
  );
}
