"use client";

/**
 * MatterContextBar — unified context bar combining:
 *  - Client / Matter (from ResolvedWorkContextProvider)
 *  - Country / Jurisdiction (passed from jurisdiction picker)
 *  - Court name (from resolved court case or props)
 *  - As-of date (for temporal legal authority queries)
 *
 * C13: This bar is placed at the top of research, draft, review, and export
 * journeys so users always see and can control the active work context.
 *
 * Specification reference (plan line 808):
 *   "Desktop: context bar with Client / File / Country / Court / As-of date;
 *    central research/draft canvas; collapsible Sources and Questions panel."
 */

import { useState } from "react";
import { Building2, Calendar, ChevronDown, Gavel, Globe, X } from "lucide-react";
import { useResolvedWorkContext, useMatter } from "@/lib/contexts/work-context";
import { WorkContextStartDialog } from "./work-context-start-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatterContextBarProps = {
  /** ISO-2 country code from the active jurisdiction picker */
  countryCode: string;
  /** Human-readable jurisdiction label (e.g. "Delhi High Court") */
  jurisdiction?: string;
  /** Court name if known from the matter's court record */
  courtName?: string;
  /** As-of date for temporal law queries (ISO date string YYYY-MM-DD) */
  asOfDate?: string;
  /** Called when the user changes the as-of date inline */
  onAsOfDateChange?: (date: string) => void;
  /** Called when the user changes country/jurisdiction via the start-work dialog */
  onCountryChange?: (countryCode: string) => void;
  className?: string;
};

// ---------------------------------------------------------------------------
// Pill — small read-only label chip
// ---------------------------------------------------------------------------

function Pill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
      title={`${label}: ${value}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// AsOfDateInput — inline date control
// ---------------------------------------------------------------------------

function AsOfDateInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (date: string) => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {onChange ? (
        <input
          type="date"
          className="bg-transparent border-0 border-b border-dashed border-muted-foreground/40 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          title="As-of date for legal authorities"
        />
      ) : (
        <span className="truncate max-w-[120px]">{value ?? "today"}</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// MatterContextBar
// ---------------------------------------------------------------------------

export function MatterContextBar({
  countryCode,
  jurisdiction,
  courtName,
  asOfDate,
  onAsOfDateChange,
  onCountryChange,
  className,
}: MatterContextBarProps) {
  const { resolved, loading, clear } = useResolvedWorkContext();
  const { matterId, clientId } = useMatter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Derive display labels from the resolved context
  const clientLabel = resolved?.clientName ?? (clientId ? `Client …${clientId.slice(-6)}` : null);
  const matterLabel = resolved?.standalone
    ? "Unassigned"
    : matterId
      ? `Matter …${matterId.slice(-6)}`
      : null;
  const contextResolved = Boolean(resolved);

  const handleDialogConfirm = () => {
    setDialogOpen(false);
    if (onCountryChange) onCountryChange(countryCode);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "flex items-center gap-1 px-4 py-1.5 text-xs text-muted-foreground bg-muted/20 border-b border-border/50 hover:bg-muted/40 transition-colors w-full",
          className,
        )}
        title="Expand context bar"
      >
        <span className="flex-1 text-left truncate">
          {clientLabel
            ? `${clientLabel}${matterLabel ? ` / ${matterLabel}` : ""} · ${countryCode}`
            : `${countryCode}${courtName ? ` · ${courtName}` : ""}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center flex-wrap gap-x-5 gap-y-2 px-4 py-2.5 bg-muted/15 border-b border-border/50 text-sm",
          className,
        )}
        role="complementary"
        aria-label="Work context"
      >
        {/* --- Client & Matter --- */}
        {clientLabel && (
          <Pill icon={Building2} label="Client" value={clientLabel} />
        )}
        {matterLabel && (
          <Pill icon={Building2} label="Matter" value={matterLabel} className="font-medium text-foreground" />
        )}

        {/* --- Country / Jurisdiction --- */}
        <Pill icon={Globe} label="Jurisdiction" value={jurisdiction ?? countryCode} />

        {/* --- Court --- */}
        {courtName && <Pill icon={Gavel} label="Court" value={courtName} />}

        {/* --- As-of date --- */}
        <AsOfDateInput value={asOfDate} onChange={onAsOfDateChange} />

        {/* --- Controls --- */}
        <div className="ml-auto flex items-center gap-2">
          {!contextResolved && !loading && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="text-xs text-primary hover:underline underline-offset-2"
            >
              Set client / matter
            </button>
          )}
          {contextResolved && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="text-xs text-muted-foreground hover:text-primary"
              title="Change work context"
            >
              Change
            </button>
          )}
          {contextResolved && (
            <button
              type="button"
              onClick={clear}
              className="text-muted-foreground hover:text-destructive"
              title="Clear work context"
              aria-label="Clear work context"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="text-muted-foreground hover:text-foreground"
            title="Collapse context bar"
            aria-label="Collapse context bar"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
          </button>
        </div>
      </div>

      <WorkContextStartDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleDialogConfirm}
        countryCode={countryCode}
      />
    </>
  );
}
