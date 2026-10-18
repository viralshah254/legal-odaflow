"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Scale } from "lucide-react"
import { getPortalOutcomeSummary } from "@/lib/api/portal"

export function PortalMatterOutlook({ matterId }: { matterId: string }) {
  const [outlook, setOutlook] = useState<Awaited<ReturnType<typeof getPortalOutcomeSummary>>>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void getPortalOutcomeSummary(matterId).then((data) => {
      setOutlook(data)
      setLoaded(true)
    })
  }, [matterId])

  if (!loaded || !outlook) return null

  return (
    <div className="mt-4 p-3 rounded-lg border bg-primary/5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Scale className="h-4 w-4 text-primary" />
        Case outlook
        {outlook.outlookLabel && (
          <Badge variant="outline">{outlook.outlookLabel}</Badge>
        )}
      </div>
      <p className="text-muted-foreground mt-2">{outlook.summary}</p>
      <p className="text-xs text-muted-foreground mt-2 italic">
        This is general case information, not legal advice or a prediction of outcome.
      </p>
    </div>
  )
}
