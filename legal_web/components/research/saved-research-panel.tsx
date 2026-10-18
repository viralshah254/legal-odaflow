"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen, CheckCircle2, Clock, ExternalLink, ShieldAlert } from "lucide-react"
import type { SavedResearchItem } from "@/lib/api/ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SavedResearchPanel({
  items,
  loading,
  title = "Filed legal research",
  emptyMessage = "No legal research has been filed here yet.",
}: {
  items: SavedResearchItem[]
  loading?: boolean
  title?: string
  emptyMessage?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
          <Badge variant="outline" className="font-normal">Firm-filed</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading filed research…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {items.map((item) => {
              const verification = item.verification
              const verified = verification?.verified && verification.safeForReliance
              const openHref = `/app/research?savedResearchId=${encodeURIComponent(item.id)}`
              return (
                <article key={item.id} className="space-y-2 p-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.query}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1" asChild>
                      <Link href={openHref}>
                        Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Badge>
                    <Badge variant="outline" className="font-normal">Firm-filed</Badge>
                    {verified ? (
                      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                        Verification required
                      </Badge>
                    )}
                    {verification?.manualReview.complete ? (
                      <Badge variant="outline">Manual review complete</Badge>
                    ) : (
                      <Badge variant="outline">
                        {verification?.manualReview.pending
                          ? `Manual review pending (${verification.manualReview.pending})`
                          : "Not manually reviewed"}
                      </Badge>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
