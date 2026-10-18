"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, BarChart2, Save, Info } from "lucide-react"
import { listAdminCreditRates, updateAdminCreditRate, type AiCreditRate } from "@/lib/api/admin-extended"

export default function AdminCreditRatesPage() {
  const [rates, setRates] = useState<AiCreditRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<AiCreditRate>>>({})

  useEffect(() => {
    listAdminCreditRates()
      .then(setRates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  const handleEdit = (id: string, field: keyof AiCreditRate, value: string | number) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleSave = async (id: string) => {
    const delta = edits[id]
    if (!delta) return
    setSaving(id)
    try {
      const updated = await updateAdminCreditRate(id, {
        baseCredits: delta.baseCredits !== undefined ? Number(delta.baseCredits) : undefined,
        markupMultiplier: delta.markupMultiplier !== undefined ? Number(delta.markupMultiplier) : undefined,
        enabled: delta.enabled,
      })
      setRates((prev) => prev.map((r) => (r.id === id ? updated : r)))
      setEdits((prev) => { const n = { ...prev }; delete n[id]; return n })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Credit Rates</h1>
          <p className="text-muted-foreground text-sm mt-1">Task credit pricing by segment</p>
        </div>
        <BarChart2 className="h-6 w-6 text-muted-foreground" />
      </div>

      <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30">
        <CardContent className="py-3 flex items-start gap-2.5 text-sm text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Display only.</strong> These rates are stored in the database for visibility but are not read by the runtime charging engine. Actual credit floors are defined in{" "}
            <code className="text-xs font-mono">credit-costs.ts</code> and applied directly at request time. Editing values here has no effect on what users are charged.
          </span>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No credit rates configured.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Task Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Segment</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Base Credits</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Markup</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((r) => {
                const edit = edits[r.id] ?? {}
                const isDirty = Object.keys(edit).length > 0
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-xs">{r.taskType}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{r.userSegment}</td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        className="h-7 w-24 text-xs"
                        value={edit.baseCredits ?? r.baseCredits}
                        onChange={(e) => handleEdit(r.id, "baseCredits", e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <Input
                        type="number"
                        step="0.1"
                        className="h-7 w-24 text-xs"
                        value={edit.markupMultiplier ?? r.markupMultiplier}
                        onChange={(e) => handleEdit(r.id, "markupMultiplier", e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isDirty && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={saving === r.id}
                          onClick={() => handleSave(r.id)}
                        >
                          {saving === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
