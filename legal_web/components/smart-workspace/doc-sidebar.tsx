"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { WorkspaceDoc } from "@/lib/api/smart-workspace"
import { FileText, Plus, Trash2, ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface DocSidebarProps {
  workspaceDocs: WorkspaceDoc[]
  activeDocumentId?: string
  availableDocs?: Array<{ id: string; fileName: string; mimeType?: string; createdAt: string }>
  onSelectDocument: (documentId: string) => void
  onAddDocument: (documentId: string) => void
  onRemoveDocument: (documentId: string) => void
  className?: string
}

const MIME_ICONS: Record<string, string> = {
  pdf: "📄",
  image: "🖼️",
  word: "📝",
  default: "📁",
}

function mimeIcon(mimeType?: string): string {
  if (!mimeType) return MIME_ICONS.default
  if (mimeType.includes("pdf")) return MIME_ICONS.pdf
  if (mimeType.includes("image")) return MIME_ICONS.image
  if (mimeType.includes("word") || mimeType.includes("document")) return MIME_ICONS.word
  return MIME_ICONS.default
}

export function DocSidebar({
  workspaceDocs,
  activeDocumentId,
  availableDocs = [],
  onSelectDocument,
  onAddDocument,
  onRemoveDocument,
  className,
}: DocSidebarProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState("")

  const workspaceDocIds = new Set(workspaceDocs.map((d) => d.documentId))
  const addable = availableDocs.filter(
    (d) => !workspaceDocIds.has(d.id) && d.fileName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className={cn("flex flex-col border-r bg-card", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => setShowPicker((v) => !v)}
          title="Add document to workspace"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Workspace docs list */}
        <div className="py-1">
          {workspaceDocs.map((wd) => {
            const isActive = wd.documentId === activeDocumentId
            const doc = wd.document
            if (!doc) return null
            return (
              <button
                key={wd.id}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors group",
                  isActive && "bg-accent",
                )}
                onClick={() => onSelectDocument(wd.documentId)}
              >
                <span className="text-base shrink-0">{mimeIcon(doc.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {isActive && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <button
                  className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveDocument(wd.documentId)
                  }}
                  title="Remove from workspace"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            )
          })}

          {workspaceDocs.length === 0 && (
            <div className="px-3 py-6 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No documents yet.</p>
              <p className="text-xs text-muted-foreground">Click + to add one.</p>
            </div>
          )}
        </div>

        {/* Document picker panel */}
        {showPicker && (
          <div className="border-t">
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search matter docs..."
                  className="h-7 pl-7 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="pb-2">
              {addable.map((doc) => (
                <button
                  key={doc.id}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    onAddDocument(doc.id)
                    setShowPicker(false)
                    setSearch("")
                  }}
                >
                  <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{doc.fileName}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">Add</Badge>
                </button>
              ))}
              {addable.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">All matter documents added.</p>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
