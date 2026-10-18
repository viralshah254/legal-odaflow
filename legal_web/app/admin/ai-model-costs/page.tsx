"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, BarChart2, Save, RefreshCw } from "lucide-react"
import {
  listAdminAiModelCosts,
  updateAdminAiModelCost,
  syncAiModelCostsFromRegistry,
  type AiModelCostConfig,
} from "@/lib/api/admin-extended"

export default function AdminAiModelCostsPage() {
  const [models, setModels] = useState<AiModelCostConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<AiModelCostConfig>>>({})

  const load = () => {
    setLoading(true)
    listAdminAiModelCosts()
      .then(setModels)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setError("")
    try {
      await syncAiModelCostsFromRegistry()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const handleEdit = (id: string, field: keyof AiModelCostConfig, value: string | number | boolean) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleSave = async (id: string) => {
    const delta = edits[id]
    if (!delta) return
    setSaving(id)
    try {
      const updated = await updateAdminAiModelCost(id, {
        inputCostPer1M: delta.inputCostPer1M !== undefined ? Number(delta.inputCostPer1M) : undefined,
        outputCostPer1M: delta.outputCostPer1M !== undefined ? Number(delta.outputCostPer1M) : undefined,
        isActive: delta.isActive,
      })
      setModels((prev) => prev.map((m) => (m.id === id ? updated : m)))
      setEdits((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
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
          <h1 className="text-2xl font-bold">AI Model Costs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Provider token pricing — {models.length} models configured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={syncing} onClick={handleSync}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync registry
          </Button>
          <BarChart2 className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : models.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No model cost configs found. Click Sync registry to import all models.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Provider</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Tier</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Input / 1M</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Output / 1M</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Active</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models.map((m) => {
                const edit = edits[m.id] ?? {}
                const isDirty = Object.keys(edit).length > 0
                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-xs">{m.modelName}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{m.provider}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{m.modelTier}</td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        step="0.000001"
                        className="h-7 w-28 text-xs"
                        value={edit.inputCostPer1M ?? m.inputCostPer1M}
                        onChange={(e) => handleEdit(m.id, "inputCostPer1M", e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        step="0.000001"
                        className="h-7 w-28 text-xs"
                        value={edit.outputCostPer1M ?? m.outputCostPer1M}
                        onChange={(e) => handleEdit(m.id, "outputCostPer1M", e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(m.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <input
                        type="checkbox"
                        checked={Boolean(edit.isActive ?? m.isActive)}
                        onChange={(e) => handleEdit(m.id, "isActive", e.target.checked)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isDirty && (
                        <Button size="sm" className="h-7 text-xs" disabled={saving === m.id} onClick={() => handleSave(m.id)}>
                          {saving === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
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
