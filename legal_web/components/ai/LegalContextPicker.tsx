"use client"
import { useTranslations } from "next-intl"

import { FileText, Scale, BookOpen, Briefcase } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ApiMatter } from "@/lib/api/types"
import type { ApiTenantDocument } from "@/lib/api/documents"
import { cn } from "@/lib/utils"

export type LegalContextScope = "matter" | "documents" | "research" | "strategy"

interface LegalContextPickerProps {
  matter?: ApiMatter | null
  documents: ApiTenantDocument[]
  selectedDocumentIds: string[]
  onDocumentToggle: (documentId: string, selected: boolean) => void
  activeScope: LegalContextScope
  onScopeChange: (scope: LegalContextScope) => void
  className?: string
}

const SCOPES: Array<{ id: LegalContextScope; label: string; icon: typeof FileText }> = [
  { id: "matter", label: "Matter facts", icon: Briefcase },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "strategy", label: "Strategy", icon: Scale },
]

export function LegalContextPicker({
  matter,
  documents,
  selectedDocumentIds,
  onDocumentToggle,
  activeScope,
  onScopeChange,
  className,
}: LegalContextPickerProps) {
  const t = useTranslations("common")
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="p-3 border-b">
        <p className="text-sm font-semibold">{t("legal_context")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose what the AI can reference for this session
        </p>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {SCOPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onScopeChange(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                activeScope === id
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {matter && activeScope === "matter" && (
          <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium">{matter.title}</p>
            <Badge variant="outline" className="text-xs">
              {matter.countryCode}
              {matter.jurisdiction ? ` · ${matter.jurisdiction}` : ""}
            </Badge>
            {matter.factsSummary && (
              <p className="text-muted-foreground text-xs line-clamp-3">{matter.factsSummary}</p>
            )}
          </div>
        )}

        {activeScope === "documents" && (
          <ScrollArea className="h-48">
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">{t("no_documents_linked_to_this_matter")}</p>
            ) : (
              <ul className="space-y-2 p-1">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`doc-${doc.id}`}
                      checked={selectedDocumentIds.includes(doc.id)}
                      onCheckedChange={(checked) => onDocumentToggle(doc.id, checked === true)}
                    />
                    <Label htmlFor={`doc-${doc.id}`} className="text-xs leading-snug cursor-pointer">
                      {doc.fileName}
                      {doc.documentType && (
                        <span className="text-muted-foreground"> · {doc.documentType}</span>
                      )}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        )}

        {(activeScope === "research" || activeScope === "strategy") && (
          <p className="text-xs text-muted-foreground">
            {activeScope === "research"
              ? "Research mode retrieves cited authorities for your jurisdiction."
              : "Strategy mode drafts options with citations from matter context."}
          </p>
        )}
      </div>
    </div>
  )
}
