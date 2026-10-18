"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import { formatDate } from "@/lib/utils"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"
import type { ConsumerCaseDraft } from "@/lib/api/consumer-case-workspace"

function stripMarkdownExcerpt(content: string, maxLen = 200): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\n+/g, " ")
    .trim()
  if (plain.length <= maxLen) return plain
  return `${plain.slice(0, maxLen).trim()}…`
}

interface ConsumerDraftCardProps {
  draft: ConsumerCaseDraft
  caseId: string
}

export function ConsumerDraftCard({ draft, caseId }: ConsumerDraftCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <li className="rounded-lg border p-4 shadow-token-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{draft.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            <Badge variant="secondary" className="mr-2 text-[10px] px-1.5 py-0">
              {draft.status}
            </Badge>
            {formatDate(draft.updatedAt)}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {stripMarkdownExcerpt(draft.content)}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href={`/consumer/cases/${caseId}/report`}>
            <FileText className="mr-2 h-3.5 w-3.5" />
            View structured report
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-2 h-3.5 w-3.5" />
              Hide preview
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-3.5 w-3.5" />
              Expand preview
            </>
          )}
        </Button>
      </div>

      {expanded && (
        <div className="max-h-[min(28rem,55vh)] overflow-y-auto rounded-lg border bg-muted/20 p-4">
          <LegalMarkdown content={draft.content} className="text-sm" />
        </div>
      )}
    </li>
  )
}
