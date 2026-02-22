"use client"

import { useState, useEffect } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import {
  getOrCreateCurrentSession,
  getArtifactsForSession,
  addArtifact,
  updateArtifact,
} from "@/lib/mock/copilot"
import type { CopilotArtifact } from "@/lib/types/copilot"
import { RichTextEditor } from "@/components/editor/simple-rich-text-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, FileText } from "lucide-react"
import { format } from "date-fns"

export function CopilotDrafts() {
  const { currentUser, currentRole } = useRole()
  const { context, hasPermission } = useCopilotContext()
  const [artifacts, setArtifacts] = useState<CopilotArtifact[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const canUseDrafts = hasPermission("canUseCopilotDrafts")

  useEffect(() => {
    const userId = currentUser?.id ?? "1"
    const session = getOrCreateCurrentSession(userId, currentRole ?? "PARTNER_ADMIN", "tenant-1", context)
    setSessionId(session.id)
    setArtifacts(getArtifactsForSession(session.id))
  }, [currentUser?.id, currentRole, context.selectedMatterId, context.selectedClientId])

  const selected = artifacts.find((a) => a.id === selectedId)

  const handleAddDraft = () => {
    if (!sessionId || !canUseDrafts) return
    const art = addArtifact(sessionId, "draft", "New draft", "")
    setArtifacts(getArtifactsForSession(sessionId))
    setSelectedId(art.id)
  }

  const handleUpdate = (id: string, content: string, title?: string) => {
    updateArtifact(id, title !== undefined ? { title, content } : { content })
    if (sessionId) setArtifacts(getArtifactsForSession(sessionId))
  }

  if (!canUseDrafts) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        You don&apos;t have permission to use Copilot drafts.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-medium">Drafts</span>
        <Button variant="outline" size="sm" onClick={handleAddDraft}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>
      <div className="flex-1 flex min-h-0">
        <ScrollArea className="w-48 border-r p-2">
          {artifacts.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No drafts yet.</p>
          )}
          {artifacts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className={`w-full text-left rounded-md px-2 py-2 text-sm flex items-center gap-2 transition-colors ${
                selectedId === a.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{a.title || "Untitled"}</span>
            </button>
          ))}
        </ScrollArea>
        <div className="flex-1 flex flex-col min-w-0 p-3">
          {selected ? (
            <>
              <Input
                value={selected.title}
                onChange={(e) => handleUpdate(selected.id, selected.content, e.target.value)}
                placeholder="Draft title"
                className="mb-2"
              />
              <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                <RichTextEditor
                  content={selected.content}
                  onChange={(content) => handleUpdate(selected.id, content)}
                  placeholder="Start typing..."
                  className="h-full"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Updated {format(selected.updatedAt, "PPp")}
              </p>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a draft or create one.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
