"use client"

import { useTranslations } from "next-intl"
import { ExternalLink } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CitationBadge } from "./CitationBadge"
import { cn } from "@/lib/utils"

export interface AISourceCitation {
  title: string
  source: string
  url?: string
  excerpt?: string
}

interface AISourcePanelProps {
  citations: AISourceCitation[]
  answer?: string | null
  className?: string
}

export function AISourcePanel({ citations, answer, className }: AISourcePanelProps) {
  const t = useTranslations("copilot")

  return (
    <div className={cn("rounded-lg border bg-muted/20 flex flex-col h-full min-h-[320px]", className)}>
      <div className="p-3 border-b">
        <p className="text-sm font-semibold">{t("sources_and_citations")}</p>
        <p className="text-xs text-muted-foreground">
          {t("sources_retrieved", { count: citations.length })}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {answer && (
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("output_label")}</p>
              <p className="text-sm whitespace-pre-wrap">{answer}</p>
            </div>
          )}

          {citations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_citations_yet")}</p>
          ) : (
            <ul className="space-y-3">
              {citations.map((citation, index) => (
                <li key={`${citation.title}-${index}`} className="rounded-md border bg-background p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{citation.title}</p>
                      <p className="text-xs text-muted-foreground">{citation.source}</p>
                    </div>
                    <CitationBadge index={index + 1} />
                  </div>
                  {citation.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{citation.excerpt}</p>
                  )}
                  {citation.url && (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {citation.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
