"use client"

import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type {
  PrivacyAssessment,
  PrivacyAssessmentStatus,
  TransferSafeguard,
} from "@/lib/api/governance"

const SAFEGUARDS: Array<{ value: TransferSafeguard; label: string }> = [
  { value: "UNASSESSED", label: "Select a safeguard" },
  { value: "CONTRACTUAL_SAFEGUARDS", label: "Contractual safeguards" },
  { value: "ADEQUACY_DECISION", label: "Adequacy decision" },
  { value: "EXPLICIT_CONSENT", label: "Explicit data-subject consent" },
  { value: "OTHER_DOCUMENTED_SAFEGUARD", label: "Other documented safeguard" },
  { value: "NOT_APPLICABLE", label: "Not applicable — no cross-border transfer" },
]

export const EMPTY_PRIVACY_ASSESSMENT: PrivacyAssessment = {
  sensitiveDataHandled: null,
  crossBorderTransfers: null,
  transferSafeguard: "UNASSESSED",
  residencyConfirmed: false,
  dpiaCompleted: false,
}

function booleanSelectValue(value: boolean | null) {
  return value === null ? "unassessed" : value ? "yes" : "no"
}

function parseBooleanSelect(value: string): boolean | null {
  return value === "yes" ? true : value === "no" ? false : null
}

export function PrivacyAssessmentForm({
  value,
  status,
  onChange,
  disabled = false,
}: {
  value: PrivacyAssessment
  status?: PrivacyAssessmentStatus
  onChange: (value: PrivacyAssessment) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-5">
      {status && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Assessment status</span>
            <Badge variant={status.status === "READY" ? "default" : "destructive"}>
              {status.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Policy {status.policyVersion}
            {status.blockers.length > 0
              ? ` · Resolve: ${status.blockers.join(", ")}`
              : " · Residency, transfer, and sensitive-data checks are resolved."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sensitive-data">Will this workspace handle sensitive personal data?</Label>
        <select
          id="sensitive-data"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={booleanSelectValue(value.sensitiveDataHandled)}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...value,
              sensitiveDataHandled: parseBooleanSelect(event.target.value),
              dpiaCompleted:
                event.target.value === "yes" ? value.dpiaCompleted : false,
            })
          }
        >
          <option value="unassessed">Select an answer</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      {value.sensitiveDataHandled === true && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="dpia-complete">DPIA completed and documented</Label>
            <p className="text-xs text-muted-foreground">
              Sensitive-data processing remains blocked until this is confirmed.
            </p>
          </div>
          <Switch
            id="dpia-complete"
            checked={value.dpiaCompleted}
            disabled={disabled}
            onCheckedChange={(dpiaCompleted) => onChange({ ...value, dpiaCompleted })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cross-border">Will data be transferred outside the configured region?</Label>
        <select
          id="cross-border"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={booleanSelectValue(value.crossBorderTransfers)}
          disabled={disabled}
          onChange={(event) => {
            const crossBorderTransfers = parseBooleanSelect(event.target.value)
            onChange({
              ...value,
              crossBorderTransfers,
              transferSafeguard:
                crossBorderTransfers === false ? "NOT_APPLICABLE" : "UNASSESSED",
            })
          }}
        >
          <option value="unassessed">Select an answer</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      {value.crossBorderTransfers === true && (
        <div className="space-y-2">
          <Label htmlFor="transfer-safeguard">Documented transfer safeguard</Label>
          <select
            id="transfer-safeguard"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={value.transferSafeguard}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                transferSafeguard: event.target.value as TransferSafeguard,
              })
            }
          >
            {SAFEGUARDS.filter((option) => option.value !== "NOT_APPLICABLE").map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="residency-confirmed">Configured storage region verified</Label>
          <p className="text-xs text-muted-foreground">
            Kenya workspaces must use the permitted region before processing starts.
          </p>
        </div>
        <Switch
          id="residency-confirmed"
          checked={value.residencyConfirmed}
          disabled={disabled}
          onCheckedChange={(residencyConfirmed) =>
            onChange({ ...value, residencyConfirmed })
          }
        />
      </div>
    </div>
  )
}
