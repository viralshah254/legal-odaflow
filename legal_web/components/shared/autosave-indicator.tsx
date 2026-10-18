"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutosaveIndicatorProps {
  status: SaveStatus
  lastSavedAt?: Date
}

export function AutosaveIndicator({ status, lastSavedAt }: AutosaveIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false)
      return
    }
    setVisible(true)
    if (status === 'saved') {
      const t = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(t)
    }
  }, [status])

  if (!visible) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs transition-opacity",
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Saved{lastSavedAt ? ` ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}` : ''}
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-3 w-3" />
          Save failed
        </>
      )}
    </span>
  )
}
