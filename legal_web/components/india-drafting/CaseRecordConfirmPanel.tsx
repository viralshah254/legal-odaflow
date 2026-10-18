"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type CaseRecordConfirmPayload = {
  caseRecord: {
    metadata: {
      caseRecordId: string
      version: number
      status: string
      playbookId: string
      playbookVersion: string
      sourceHash: string
    }
    parties: Array<{ id: string; role: string; name: string }>
    facts: Array<{
      id: string
      displayId?: string
      proposition: string
      status: string
      materiality?: string
      sourceType: string
    }>
    chronology: Array<{ id: string; label: string; date?: string }>
    moneyRecords?: Array<{
      id: string
      kind: string
      amountLabel: string
      description: string
      disputed?: boolean
      confirmationState?: string
    }>
    contradictions: Array<{
      id: string
      factId1: string
      factId2: string
      description: string
      severity: string
      resolution?: { chosenFactId: string }
    }>
    missingFields: Array<{ field: string; description: string; blocking: boolean }>
    matterData: Record<string, unknown>
    statutes: Array<{ actId: string; section: string; raw: string; charged: boolean }>
  }
  playbook: {
    id: string
    documentKind: string
    version: string
    planningMode: string
    filingGrade: boolean
    mandatoryFields: Array<{ id: string; label: string; blocking: boolean }>
    partyLabel?: string
  }
  intakeValidation: {
    ok: boolean
    findings: Array<{ id: string; severity: string; message: string }>
    missingBlockingFields: string[]
  }
  conflictSuggestions: Array<{
    contradictionId: string
    preferredFactId: string
    reason: string
  }>
}

type Props = {
  payload: CaseRecordConfirmPayload
  confirming?: boolean
  onConfirm: (
    resolutions: Array<{ contradictionId: string; chosenFactId: string; note?: string }>,
  ) => void
  onCancel?: () => void
  className?: string
}

export function CaseRecordConfirmPanel({
  payload,
  confirming,
  onConfirm,
  onCancel,
  className,
}: Props) {
  const unresolved = useMemo(
    () => payload.caseRecord.contradictions.filter((c) => !c.resolution),
    [payload.caseRecord.contradictions],
  )
  const [resolutions, setResolutions] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const s of payload.conflictSuggestions) {
      init[s.contradictionId] = s.preferredFactId
    }
    return init
  })

  const checklist = (payload.caseRecord.matterData?.bailChecklist as
    | { fields?: Record<string, { state: string; value?: string }> }
    | undefined)?.fields

  const noticeFields = payload.caseRecord.matterData as {
    senderName?: string
    recipientName?: string
    demandAmount?: string
    demandBasis?: string
    curePeriod?: string
  }

  const contractFields = payload.caseRecord.matterData as {
    transactionType?: string
    governingLawPreference?: string
  }

  const blockerFindings = payload.intakeValidation.findings.filter(
    (f) => f.severity === "blocker",
  )

  const canConfirm =
    unresolved.every((c) => resolutions[c.id]) && blockerFindings.length === 0

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Confirm Case Record</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review extracted facts before generation. Editing later invalidates drafts and
            approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">v{payload.caseRecord.metadata.version}</Badge>
          <Badge variant="outline">{payload.playbook.documentKind}</Badge>
          <Badge variant="outline">playbook {payload.playbook.version}</Badge>
        </div>
      </div>

      {blockerFindings.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Intake blockers</p>
          <ul className="mt-1 list-disc pl-4 space-y-1">
            {blockerFindings.map((f) => (
              <li key={f.id}>{f.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h4 className="text-sm font-medium mb-2">Parties</h4>
        <ul className="text-sm space-y-1">
          {payload.caseRecord.parties.map((p) => (
            <li key={p.id}>
              <span className="text-muted-foreground">{p.role}:</span> {p.name}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-medium mb-2">Chronology</h4>
        {payload.caseRecord.chronology.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chronology events extracted.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {payload.caseRecord.chronology.map((e) => (
              <li key={e.id}>
                {e.label}
                {e.date ? ` — ${e.date}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(payload.caseRecord.moneyRecords?.length ?? 0) > 0 && (
        <section>
          <h4 className="text-sm font-medium mb-2">Amounts</h4>
          <ul className="text-sm space-y-1">
            {payload.caseRecord.moneyRecords!.map((m) => (
              <li key={m.id}>
                <span className="text-muted-foreground">{m.kind}:</span> {m.amountLabel}
                {m.disputed ? " (disputed)" : ""}
                {m.description ? (
                  <span className="text-muted-foreground"> — {m.description.slice(0, 80)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-sm font-medium mb-2">Facts</h4>
        <ul className="text-sm space-y-1.5 max-h-48 overflow-y-auto">
          {payload.caseRecord.facts.map((f) => (
            <li key={f.id} className="flex gap-2">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {f.displayId ?? f.id.slice(0, 10)}
              </span>
              <span>
                {f.proposition}
                {f.materiality ? (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {f.materiality}
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {checklist && (
        <section>
          <h4 className="text-sm font-medium mb-2">Bail checklist</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            {Object.entries(checklist).map(([key, val]) => (
              <div key={key} className="flex justify-between gap-2 rounded border px-2 py-1">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium">
                  {val.state}
                  {val.value ? `: ${val.value}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(noticeFields.senderName || noticeFields.demandBasis) && !checklist && (
        <section>
          <h4 className="text-sm font-medium mb-2">Notice fields</h4>
          <ul className="text-sm space-y-1">
            {noticeFields.senderName && <li>Sender: {noticeFields.senderName}</li>}
            {noticeFields.recipientName && <li>Recipient: {noticeFields.recipientName}</li>}
            {noticeFields.demandAmount && <li>Demand: {noticeFields.demandAmount}</li>}
            {noticeFields.demandBasis && <li>Basis: {noticeFields.demandBasis}</li>}
            {noticeFields.curePeriod && <li>Cure period: {noticeFields.curePeriod}</li>}
          </ul>
        </section>
      )}

      {contractFields.transactionType && !checklist && !noticeFields.demandBasis && (
        <section>
          <h4 className="text-sm font-medium mb-2">Contract fields</h4>
          <ul className="text-sm space-y-1">
            <li>Type: {contractFields.transactionType}</li>
            {contractFields.governingLawPreference && (
              <li>Governing law: {contractFields.governingLawPreference}</li>
            )}
          </ul>
        </section>
      )}

      {unresolved.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Resolve contradictions</h4>
          {unresolved.map((c) => {
            const suggestion = payload.conflictSuggestions.find(
              (s) => s.contradictionId === c.id,
            )
            const fact1 = payload.caseRecord.facts.find((f) => f.id === c.factId1)
            const fact2 = payload.caseRecord.facts.find((f) => f.id === c.factId2)
            return (
              <div key={c.id} className="rounded-lg border p-3 space-y-2 text-sm">
                <p>{c.description}</p>
                {suggestion && (
                  <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                )}
                <div className="flex flex-col gap-1">
                  {[fact1, fact2].filter(Boolean).map((f) => (
                    <label key={f!.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={c.id}
                        checked={resolutions[c.id] === f!.id}
                        onChange={() =>
                          setResolutions((prev) => ({ ...prev, [c.id]: f!.id }))
                        }
                      />
                      <span>{f!.proposition}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {payload.caseRecord.missingFields.length > 0 && (
        <section>
          <h4 className="text-sm font-medium mb-1">Missing fields</h4>
          <ul className="text-sm list-disc pl-4 text-muted-foreground">
            {payload.caseRecord.missingFields.map((m) => (
              <li key={m.field}>
                {m.description}
                {m.blocking ? " (blocking)" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          disabled={!canConfirm || confirming}
          onClick={() =>
            onConfirm(
              Object.entries(resolutions).map(([contradictionId, chosenFactId]) => ({
                contradictionId,
                chosenFactId,
              })),
            )
          }
        >
          {confirming ? "Confirming…" : "Confirm Case Record"}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
