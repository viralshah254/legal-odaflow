"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle, FileUp, Loader2, Plus, Search, UserPlus, X } from "lucide-react"
import { listClients } from "@/lib/api/clients"
import { getMatter, listMatters } from "@/lib/api/matters"
import { saveResearchToClient } from "@/lib/api/ai"
import { uploadFileViaPresignedUrl, uploadTenantDocument } from "@/lib/api/documents"
import { addDocumentToWorkspace, getOrCreateMatterWorkspace } from "@/lib/api/smart-workspace"
import type { ApiClient, ApiMatter, LegalResearchResponse } from "@/lib/api/types"
import { CreateClientDialog } from "@/components/clients/create-client-dialog"
import { queryKeys } from "@/lib/api/query-keys"
import { buildResearchDocument } from "@/lib/research/research-filing"
import { getResearchRelianceState } from "@/lib/api/verification"
import { AnalyticsEvents } from "@/lib/analytics/events"
import { trackResearchEvent } from "@/lib/analytics/research-events"

interface SaveResearchDialogProps {
  open: boolean
  onClose: () => void
  tenantId: string
  title: string
  query: string
  countryCode?: string
  aiOutputId?: string
  researchJson: Record<string, unknown>
  result: LegalResearchResponse
  initialClientId?: string
  initialMatterId?: string
  mode?: "client" | "matter" | "document"
  onSaved?: (aiOutputId?: string) => void | Promise<void>
}

export function SaveResearchDialog({
  open,
  onClose,
  tenantId,
  title,
  query,
  countryCode,
  aiOutputId,
  researchJson,
  result,
  initialClientId,
  initialMatterId,
  mode = "client",
  onSaved,
}: SaveResearchDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [clients, setClients] = useState<ApiClient[]>([])
  const [matters, setMatters] = useState<ApiMatter[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ApiClient | null>(null)
  const [matterId, setMatterId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createInitialName, setCreateInitialName] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const requiresMatter = mode === "matter" || mode === "document"

  const fetchClients = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const res = await listClients(tenantId, q || undefined)
        setClients(res)
      } catch {
        setClients([])
      } finally {
        setLoading(false)
      }
    },
    [tenantId],
  )

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSelected(null)
      setMatterId("")
      setMatters([])
      setSaved(false)
      setError(null)
      setCreateOpen(false)
      return
    }
    void fetchClients("")
    if (initialMatterId) {
      void getMatter(tenantId, initialMatterId)
        .then((matter) => {
          setMatterId(matter.id)
          return listClients(tenantId)
            .then((available) => {
              setClients(available)
              setSelected(available.find((client) => client.id === matter.clientId) ?? null)
            })
        })
        .catch(() => undefined)
    } else if (initialClientId) {
      void listClients(tenantId).then((available) => {
        setClients(available)
        setSelected(available.find((client) => client.id === initialClientId) ?? null)
      }).catch(() => undefined)
    }
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [open, fetchClients, initialClientId, initialMatterId, tenantId])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      void fetchClients(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, fetchClients, open])

  useEffect(() => {
    if (!selected) {
      setMatters([])
      if (!initialMatterId) setMatterId("")
      return
    }
    listMatters(tenantId, { clientId: selected.id })
      .then(setMatters)
      .catch(() => setMatters([]))
  }, [initialMatterId, selected, tenantId])

  const refreshFiledData = async (clientId: string, selectedMatterId?: string) => {
    const requests = [
      queryClient.invalidateQueries({
        queryKey: queryKeys.research.saved(tenantId, { clientId }),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.activity(tenantId, clientId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.documents(tenantId, clientId),
      }),
    ]
    if (selectedMatterId) {
      requests.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.research.saved(tenantId, { matterId: selectedMatterId }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.operationalTimeline(tenantId, selectedMatterId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.matters.documents(tenantId, selectedMatterId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["smart-workspace", selectedMatterId, tenantId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-canvas-nodes"],
        }),
      )
    }
    await Promise.all(requests)
  }

  const handleSave = async () => {
    if (!selected || (requiresMatter && !matterId)) return
    setSaving(true)
    setError(null)
    try {
      const filed = await saveResearchToClient(
        {
          clientId: selected.id,
          matterId: matterId || undefined,
          aiOutputId,
          title: title.slice(0, 300),
          query,
          countryCode,
          researchJson,
        },
        tenantId,
      )
      if (mode === "document") {
        const markdown = buildResearchDocument({
          title,
          query,
          countryCode,
          result,
          aiOutputId,
        })
        const file = new File([markdown.contents], markdown.fileName, {
          type: "text/markdown",
        })
        const uploaded = await uploadFileViaPresignedUrl(tenantId, file)
        const document = await uploadTenantDocument(tenantId, {
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          mimeType: file.type,
          fileSizeBytes: file.size,
          clientId: selected.id,
          matterId,
          documentType: "LEGAL_RESEARCH",
        })
        if (matterId) {
          try {
            const workspace = await getOrCreateMatterWorkspace(tenantId, matterId)
            await addDocumentToWorkspace(tenantId, workspace.id, document.id)
          } catch {
            // Document is filed; workspace attachment is best-effort.
          }
        }
      }
      const safeForReliance =
        getResearchRelianceState({
          audit: result.citationAudit,
          findings: result.findings,
          publicationState: result.publicationState,
          researchMode: result.researchMode,
        }) === "source-verified"
      if (mode === "document") {
        trackResearchEvent(AnalyticsEvents.RESEARCH_DOCUMENT_FILED, {
          aiOutputId,
          clientId: selected.id,
          matterId,
          safeForReliance,
        })
      } else {
        trackResearchEvent(AnalyticsEvents.RESEARCH_MATTER_CLIENT_FILED, {
          aiOutputId,
          savedResearchId: filed.id,
          clientId: selected.id,
          matterId: matterId || undefined,
          destination: matterId ? "matter" : "client",
          safeForReliance,
        })
      }
      await refreshFiledData(selected.id, matterId || undefined)
      await onSaved?.(aiOutputId)
      setSaved(true)
      setTimeout(onClose, 1400)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to file research. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-background rounded-xl shadow-xl border w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <p className="text-sm font-semibold">
                {mode === "document"
                  ? "File as matter document"
                  : mode === "matter"
                    ? "Add to matter research"
                    : "Save research to client"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">{title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {saved ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-medium text-sm">
                {mode === "document"
                  ? "Research document filed to Documents"
                  : mode === "matter"
                    ? "Research filed to matter canvas"
                    : "Research filed to client"}
                {" — "}{selected?.name}&apos;s file
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 pt-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients by name..."
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto px-5 pb-3">
                {loading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-xs">Loading clients…</span>
                  </div>
                ) : clients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <UserPlus className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No clients found{search ? ` for "${search}"` : ""}.</p>
                    {search.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCreateInitialName(search.trim())
                          setCreateOpen(true)
                        }}
                        className="mt-2 text-xs text-primary inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Create &quot;{search.trim()}&quot;
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {clients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selected?.id === c.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted"
                          }`}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected && (matters.length > 0 || requiresMatter) && (
                <div className="px-5 pb-3">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Matter {requiresMatter ? "(required)" : "(optional)"}
                  </label>
                  <select
                    value={matterId}
                    onChange={(e) => setMatterId(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2 bg-background"
                  >
                    <option value="">{requiresMatter ? "Select a matter" : "No matter"}</option>
                    {matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <p className="px-5 pb-2 text-xs text-destructive">{error}</p>
              )}

              <div className="px-5 py-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selected || (requiresMatter && !matterId) || saving}
                  onClick={() => void handleSave()}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {mode === "document" && <FileUp className="h-3.5 w-3.5" />}
                  {mode === "document"
                    ? "File to Documents"
                    : mode === "matter"
                      ? "Add to matter research"
                      : "Save to client"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={createInitialName}
        onCreated={(client) => {
          setSelected(client)
          setClients((prev) => [client, ...prev.filter((c) => c.id !== client.id)])
          setCreateOpen(false)
        }}
      />
    </>
  )
}
