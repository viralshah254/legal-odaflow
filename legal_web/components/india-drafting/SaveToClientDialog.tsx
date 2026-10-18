"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle, FileUp, Loader2, Plus, Search, UserPlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { uploadFileViaPresignedUrl, uploadTenantDocument } from "@/lib/api/documents"
import { linkDraftToClient } from "@/lib/api/india-drafting"
import { updateSavedDraft } from "@/lib/api/draft-history"
import type { ApiClient, ApiMatter } from "@/lib/api/types"
import { CreateClientDialog } from "@/components/clients/create-client-dialog"
import { queryKeys } from "@/lib/api/query-keys"

interface SaveToClientDialogProps {
  open: boolean
  onClose: () => void
  /** Fired after a successful save (used for implicit training feedback). */
  onSaved?: (linked: {
    clientId: string
    clientName: string
    matterId?: string
    matterTitle?: string
  }) => void
  draftId: string
  tenantId: string
  documentLabel: string
  draftText: string
  suggestedClientName?: string
}

export function SaveToClientDialog({
  open,
  onClose,
  onSaved,
  draftId,
  tenantId,
  documentLabel,
  draftText,
  suggestedClientName,
}: SaveToClientDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [clients, setClients] = useState<ApiClient[]>([])
  const [matters, setMatters] = useState<ApiMatter[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ApiClient | null>(null)
  const [matterId, setMatterId] = useState("")
  const [createDocument, setCreateDocument] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createInitialName, setCreateInitialName] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

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
      setMatters([])
      setMatterId("")
      setCreateDocument(false)
      setSaved(false)
      setError(null)
      setCreateOpen(false)
      return
    }
    const initial = suggestedClientName?.trim() ?? ""
    setSearch(initial)
    void fetchClients(initial)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [open, fetchClients, suggestedClientName])

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
      setMatterId("")
      return
    }
    setMatterId("")
    void listMatters(tenantId, { clientId: selected.id })
      .then(setMatters)
      .catch(() => setMatters([]))
  }, [selected, tenantId])

  const handleSave = async () => {
    if (!selected || (createDocument && !matterId)) return
    setSaving(true)
    setError(null)
    try {
      // Flush the latest editor state before attaching the durable record.
      await updateSavedDraft(draftId, { draftText }, tenantId)
      await linkDraftToClient(
        draftId,
        {
          clientId: selected.id,
          matterId: matterId || undefined,
          clientName: selected.name,
        },
        tenantId,
      )
      const linkedMatter = matterId
        ? matters.find((matter) => matter.id === matterId)
        : undefined
      if (createDocument) {
        const safeName = documentLabel.trim().replace(/[^\w.-]+/g, "-").replace(/-+/g, "-") || "court-draft"
        const file = new File([draftText], `${safeName}.md`, { type: "text/markdown" })
        const uploaded = await uploadFileViaPresignedUrl(tenantId, file)
        await uploadTenantDocument(tenantId, {
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          mimeType: file.type,
          fileSizeBytes: file.size,
          clientId: selected.id,
          matterId,
          documentType: "COURT_DRAFT",
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.clients.documents(tenantId, selected.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.clients.activity(tenantId, selected.id),
        }),
        ...(matterId
          ? [
              queryClient.invalidateQueries({
                queryKey: queryKeys.matters.documents(tenantId, matterId),
              }),
              queryClient.invalidateQueries({
                queryKey: queryKeys.matters.operationalTimeline(tenantId, matterId),
              }),
            ]
          : []),
      ])
      onSaved?.({
        clientId: selected.id,
        clientName: selected.name,
        matterId: matterId || undefined,
        matterTitle: linkedMatter?.title,
      })
      setSaved(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to link draft. Please try again."
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const openCreateWithName = (name: string) => {
    setCreateInitialName(name.trim())
    setCreateOpen(true)
  }

  const handleClientCreated = (client: ApiClient) => {
    setSelected(client)
    setClients((prev) => [client, ...prev.filter((c) => c.id !== client.id)])
    setCreateOpen(false)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-background rounded-xl shadow-xl border w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <p className="text-sm font-semibold">Save draft to docket</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">{documentLabel}</p>
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
              <p className="font-medium text-sm">Draft linked to {selected?.name}&apos;s docket</p>
              <p className="text-xs text-muted-foreground">
                {createDocument
                  ? "The editable draft was linked and a file-center document was created."
                  : "The editable draft was linked. No file-center document was created."}
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
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search clients by name..."
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto px-5 pb-3">
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
                        onClick={() => openCreateWithName(search)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add &quot;{search.trim()}&quot; as new client
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openCreateWithName("")}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create new client
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {clients.map(client => (
                      <li key={client.id}>
                        <button
                          onClick={() => setSelected(selected?.id === client.id ? null : client)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                            selected?.id === client.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold shrink-0 text-primary">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{client.name}</p>
                            {client.email && (
                              <p className={cn("text-xs truncate", selected?.id === client.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                {client.email}
                              </p>
                            )}
                          </div>
                          {selected?.id === client.id && (
                            <CheckCircle className="h-4 w-4 ml-auto shrink-0" />
                          )}
                        </button>
                      </li>
                    ))}
                    {!loading && search.trim() && !clients.some(c => c.name.toLowerCase() === search.trim().toLowerCase()) && (
                      <li>
                        <button
                          type="button"
                          onClick={() => openCreateWithName(search)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/60"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add &quot;{search.trim()}&quot; as new client
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {selected && (
                <div className="px-5 pb-3 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Matter (optional)
                    </label>
                    <select
                      value={matterId}
                      onChange={(event) => setMatterId(event.target.value)}
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-background"
                    >
                      <option value="">Client docket only</option>
                      {matters.map((matter) => (
                        <option key={matter.id} value={matter.id}>
                          {matter.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs font-medium">Editable draft record</p>
                    <p className="text-xs text-muted-foreground">
                      Always links this live draft to the selected client
                      {matterId ? " and matter" : ""}. Future edits remain on the draft record.
                    </p>
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={createDocument}
                        onChange={(event) => setCreateDocument(event.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Also create a snapshot in the matter file center
                        <span className="block text-muted-foreground">
                          Creates a separate Document from the current draft text. A matter is required.
                        </span>
                      </span>
                    </label>
                    {createDocument && !matterId && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Select a matter to create the file-center document.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p className="px-5 text-xs text-destructive pb-2">{error}</p>
              )}

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!selected || saving || (createDocument && !matterId)}
                  className={cn(
                    "px-4 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors",
                    !selected || saving || (createDocument && !matterId)
                      ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  ) : (
                    <>{createDocument && <FileUp className="h-3.5 w-3.5" />} Save to docket</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleClientCreated}
        initialName={createInitialName}
      />
    </>
  )
}
