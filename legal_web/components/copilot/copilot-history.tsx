"use client"
import { useTranslations } from "next-intl"

import { useCallback, useEffect, useState } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { listCopilotSessions, getCopilotSessionMessages, type CopilotSessionApi, type CopilotChatMessage } from "@/lib/api/copilot"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, MessageSquare, RefreshCw, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatSessionTimestamp,
  getSessionMeta,
  getSessionPreview,
  getSessionSubtitle,
  getSessionTitle,
  stripMarkdownInline,
} from "@/lib/copilot/session-display"

interface CopilotHistoryProps {
  onLoadSession?: (sessionId: string, messages: CopilotChatMessage[]) => void
}

export function CopilotHistory({ onLoadSession }: CopilotHistoryProps) {
  const t = useTranslations("copilot")
  const tCommon = useTranslations("common")
  const { activeTenantId } = useTenant()
  const [sessions, setSessions] = useState<CopilotSessionApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeTenantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listCopilotSessions(activeTenantId)
      setSessions(data.slice(0, 30))
    } catch {
      setError(t("couldNotLoadHistory"))
    } finally {
      setLoading(false)
    }
  }, [activeTenantId, t])

  useEffect(() => { void load() }, [load])

  const handleLoadSession = async (session: CopilotSessionApi) => {
    if (!activeTenantId || !onLoadSession) return
    setLoadingSessionId(session.id)
    try {
      const msgs = await getCopilotSessionMessages(activeTenantId, session.id)
      onLoadSession(session.id, msgs)
    } catch {
      // Silently fail — the user can still click again
    } finally {
      setLoadingSessionId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {tCommon("retry")}
        </Button>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <History className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{t("no_sessions_yet")}</p>
        <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">{t("historyEmptyHint")}</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("recentSessions")}
        </p>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => void load()} title={tCommon("refresh")}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {sessions.map((session) => {
        const title = getSessionTitle(session, t("sessionUntitled"))
        const subtitle = getSessionSubtitle(session)
        const preview = getSessionPreview(session, t("noContent"))
        const { matter, client } = getSessionMeta(session)

        return (
          <button
            key={session.id}
            type="button"
            onClick={() => void handleLoadSession(session)}
            disabled={loadingSessionId === session.id || !onLoadSession}
            className={cn(
              "w-full rounded-lg border bg-card/50 p-3 text-left hover:bg-muted/30 transition-colors group",
              loadingSessionId === session.id && "opacity-60",
            )}
          >
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                {loadingSessionId === session.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug line-clamp-2">{title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {formatSessionTimestamp(session.updatedAt)}
                  </span>
                </div>

                {(matter || client) && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {matter && (
                      <Badge variant="secondary" className="text-[10px] font-normal max-w-full truncate">
                        {matter}
                      </Badge>
                    )}
                    {client && (
                      <Badge variant="outline" className="text-[10px] font-normal max-w-full truncate">
                        {client}
                      </Badge>
                    )}
                  </div>
                )}

                {subtitle && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                    {stripMarkdownInline(subtitle)}
                  </p>
                )}

                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{preview}</p>
              </div>

              {onLoadSession && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
