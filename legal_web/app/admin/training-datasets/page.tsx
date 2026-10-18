"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Database, Plus, Eye, Check, X } from "lucide-react"
import {
  listAdminTrainingDatasets,
  createAdminTrainingDataset,
  updateAdminTrainingDatasetStatus,
  listAdminTrainingDatasetItems,
  approveTrainingDatasetItem,
  revokeTrainingDatasetItem,
  type TrainingDataset,
  type TrainingDatasetItem,
} from "@/lib/api/admin-extended"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  ARCHIVED: "bg-muted text-muted-foreground",
}

const APPROVAL_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  REVOKED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
}

const DATASET_TYPES = ["FINE_TUNE", "RAG", "EVALUATION", "PROMPT_EXAMPLES"]
const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "ARCHIVED"]

export default function AdminTrainingDatasetsPage() {
  const [datasets, setDatasets] = useState<TrainingDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", datasetType: "FINE_TUNE", countryCode: "", description: "" })

  // Item viewer
  const [viewingDataset, setViewingDataset] = useState<TrainingDataset | null>(null)
  const [items, setItems] = useState<TrainingDatasetItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    listAdminTrainingDatasets()
      .then(setDatasets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setCreating(true)
    try {
      await createAdminTrainingDataset({
        name: createForm.name,
        datasetType: createForm.datasetType,
        countryCode: createForm.countryCode || undefined,
        description: createForm.description || undefined,
      })
      setCreateForm({ name: "", datasetType: "FINE_TUNE", countryCode: "", description: "" })
      setShowCreate(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateAdminTrainingDatasetStatus(id, status)
      setDatasets((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)))
    } catch {
      setError("Failed to update status")
    }
  }

  const openItemViewer = async (dataset: TrainingDataset) => {
    setViewingDataset(dataset)
    setLoadingItems(true)
    try {
      const result = await listAdminTrainingDatasetItems(dataset.id)
      setItems(result)
    } catch {
      setItems([])
    } finally {
      setLoadingItems(false)
    }
  }

  const handleApprove = async (itemId: string) => {
    if (!viewingDataset) return
    setActioning(itemId)
    try {
      const updated = await approveTrainingDatasetItem(viewingDataset.id, itemId)
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)))
    } catch {
      setError("Failed to approve item")
    } finally {
      setActioning(null)
    }
  }

  const handleRevoke = async (itemId: string) => {
    if (!viewingDataset) return
    setActioning(itemId)
    try {
      const updated = await revokeTrainingDatasetItem(viewingDataset.id, itemId)
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)))
    } catch {
      setError("Failed to revoke item")
    } finally {
      setActioning(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Training Datasets</h1>
          <p className="text-muted-foreground text-sm mt-1">Approved anonymised datasets ({datasets.length})</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Dataset
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Training Dataset</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. India Contract Law Q&A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={createForm.datasetType} onValueChange={(v) => setCreateForm((f) => ({ ...f, datasetType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DATASET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Country Code</Label>
                  <Input
                    value={createForm.countryCode}
                    onChange={(e) => setCreateForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase() }))}
                    placeholder="e.g. IN"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description..."
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={creating || !createForm.name.trim()}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Country</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Items</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {datasets.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-sm">{d.name}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{d.datasetType}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{d.countryCode ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums hidden md:table-cell">{d.itemCount}</td>
                  <td className="px-4 py-2.5">
                    <Select value={d.status} onValueChange={(v) => handleStatusChange(d.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-28 gap-1">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status] ?? "bg-muted"}`}>
                          {d.status}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openItemViewer(d)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Items
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datasets.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No datasets found.</div>
          )}
        </div>
      )}

      {/* Item viewer dialog */}
      <Dialog open={!!viewingDataset} onOpenChange={(open) => { if (!open) setViewingDataset(null) }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingDataset?.name} — Items</DialogTitle>
          </DialogHeader>

          {loadingItems ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No items in this dataset yet.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {items.map((item) => (
                <Card key={item.id} className="text-sm">
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_COLORS[item.approvalStatus] ?? "bg-muted"}`}>
                        {item.approvalStatus}
                      </span>
                      <div className="flex gap-2">
                        {item.approvalStatus !== "APPROVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-600 border-green-600/30 hover:bg-green-50 dark:hover:bg-green-900/20"
                            disabled={actioning === item.id}
                            onClick={() => handleApprove(item.id)}
                          >
                            {actioning === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                            Approve
                          </Button>
                        )}
                        {item.approvalStatus !== "REVOKED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={actioning === item.id}
                            onClick={() => handleRevoke(item.id)}
                          >
                            {actioning === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Input</p>
                      <p className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap">{item.inputText}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Expected Output</p>
                      <p className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap">{item.outputText ?? "—"}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
