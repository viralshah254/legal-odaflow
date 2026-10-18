"use client"
import { useTranslations } from "next-intl"

import { Loader2, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { LegalContextScope } from "./LegalContextPicker"
import { cn } from "@/lib/utils"

interface LegalAIComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  loading?: boolean
  activeScope: LegalContextScope
  scopeLabel?: string
  placeholder?: string
  estimatedCredits?: number
  className?: string
}

const SCOPE_PROMPTS: Record<LegalContextScope, string[]> = {
  matter: ["Summarize key facts", "What deadlines apply?", "Identify missing evidence"],
  documents: ["Extract key clauses", "Compare versions", "Flag risk terms"],
  research: ["What is the applicable law?", "Find supporting case law", "Check limitation period"],
  strategy: ["Draft strategy options", "Assess opponent arguments", "Recommend next steps"],
}

export function LegalAIComposer({
  value,
  onChange,
  onSubmit,
  loading = false,
  activeScope,
  scopeLabel,
  placeholder,
  estimatedCredits,
  className,
}: LegalAIComposerProps) {
  const t = useTranslations("common")
  const tCopilot = useTranslations("copilot")
  const quickPrompts = SCOPE_PROMPTS[activeScope]
  const resolvedPlaceholder = placeholder ?? tCopilot("placeholder")

  return (
    <div className={cn("rounded-lg border bg-card flex flex-col", className)}>
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t("ai_composer")}</span>
        </div>
        {scopeLabel && <Badge variant="outline">{scopeLabel}</Badge>}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onChange(prompt)}
              disabled={loading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <Textarea
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              if (value.trim()) onSubmit()
            }
          }}
        />

        <div className="flex items-center justify-between gap-2">
          {estimatedCredits != null && (
            <p className="text-xs text-muted-foreground">
              Est. {estimatedCredits} credits · ⌘↵ to send
            </p>
          )}
          <Button
            className="ml-auto"
            onClick={onSubmit}
            disabled={loading || !value.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
