"use client"
import { useTranslations } from "next-intl"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react"
import { createConflictCheck, type ConflictCheck } from "@/lib/api/conflicts"
import { ApiClientError } from "@/lib/api/client"

type PartyInput = {
  name?: string
  email?: string
}

type ConflictCheckPanelProps = {
  tenantId: string
  clientId?: string
  matterId?: string
  parties: PartyInput[]
  autoRun?: boolean
  onClear?: (result: ConflictCheck) => void
  onReviewRequired?: (result: ConflictCheck) => void
}

export function ConflictCheckPanel({
  tenantId,
  clientId,
  matterId,
  parties,
  autoRun = false,
  onClear,
  onReviewRequired,
}: ConflictCheckPanelProps) {
  const t = useTranslations("common")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConflictCheck | null>(null)

  const normalizedParties = useMemo(
    () => parties.filter((party) => party.name?.trim() || party.email?.trim()),
    [parties],
  )
  const partiesKey = JSON.stringify(normalizedParties)

  const runCheck = useCallback(async () => {
    if (normalizedParties.length === 0) {
      setError("Add at least one party name or email to run a conflict check.")
      return
    }

    setChecking(true)
    setError(null)
    try {
      const check = await createConflictCheck(tenantId, {
        clientId,
        matterId,
        parties: normalizedParties,
      })
      setResult(check)
      if (check.status === "CLEAR") {
        onClear?.(check)
      } else {
        onReviewRequired?.(check)
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Conflict check failed")
    } finally {
      setChecking(false)
    }
  }, [clientId, matterId, normalizedParties, onClear, onReviewRequired, tenantId])

  useEffect(() => {
    if (!autoRun || normalizedParties.length === 0) return
    setResult(null)
    const timer = window.setTimeout(() => {
      void runCheck()
    }, 500)
    return () => window.clearTimeout(timer)
    // partiesKey deliberately represents the normalized party inputs.
  }, [autoRun, partiesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const matches =
    result?.result &&
    typeof result.result === "object" &&
    "matches" in result.result &&
    Array.isArray((result.result as { matches?: unknown[] }).matches)
      ? ((result.result as { matches: Array<{ type: string; name: string; reason: string }> })
          .matches)
      : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Conflict check
        </CardTitle>
        <CardDescription>
          Screen parties against existing clients and matter contacts before intake.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {normalizedParties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Enter client or opposing party details above to enable conflict screening.
          </p>
        ) : (
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {normalizedParties.map((party, index) => (
              <li key={`${party.name ?? ""}-${party.email ?? ""}-${index}`}>
                {party.name ?? "Unnamed"}
                {party.email ? ` (${party.email})` : ""}
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={runCheck}
          disabled={checking || normalizedParties.length === 0}
        >
          {checking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking…
            </>
          ) : (
            "Run conflict check"
          )}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              {result.status === "CLEAR" ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <Badge variant="default">{t("clear")}</Badge>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <Badge variant="destructive">{t("review_required")}</Badge>
                </>
              )}
            </div>
            {typeof result.result === "object" &&
              result.result &&
              "summary" in result.result && (
                <p className="text-sm">{String((result.result as { summary?: string }).summary)}</p>
              )}
            {matches.length > 0 && (
              <ul className="text-sm space-y-2">
                {matches.map((match, index) => (
                  <li key={`${match.type}-${match.name}-${index}`} className="rounded-md bg-muted/50 p-2">
                    <span className="font-medium">{match.name}</span>
                    <span className="text-muted-foreground"> · {match.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
