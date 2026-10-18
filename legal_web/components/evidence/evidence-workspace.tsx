"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EvidenceRef, MatterGraph } from "@/lib/matter-intelligence"
import { AlertTriangle, FileText, ShieldCheck } from "lucide-react"

export interface EvidenceWorkspaceProps {
  matterId: string
  matterGraph?: MatterGraph
  className?: string
}

function EvidenceFlagBadges({ item }: { item: EvidenceRef }) {
  const flags = item.flags
  if (!flags) return null
  return (
    <div className="flex flex-wrap gap-1">
      {flags.contradiction && (
        <Badge variant="outline" className="border-amber-500/50 text-amber-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Contradiction
        </Badge>
      )}
      {flags.paymentProof && (
        <Badge variant="outline" className="border-emerald-500/50 text-emerald-700">
          Payment proof
        </Badge>
      )}
      {flags.threat && (
        <Badge variant="outline" className="border-red-500/50 text-red-700">
          Threat
        </Badge>
      )}
      {flags.admission && (
        <Badge variant="outline">Admission</Badge>
      )}
    </div>
  )
}

/** P13-05 — MI graph evidence list with source doc links and analysis badges. */
export function EvidenceWorkspace({ matterId, matterGraph, className }: EvidenceWorkspaceProps) {
  const items = matterGraph?.evidence ?? []

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" />
          Matter intelligence evidence
        </CardTitle>
        <CardDescription>
          Structured items extracted from uploaded documents (OCR → MI pipeline)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No extracted evidence yet. Upload documents to this matter to populate the graph.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((item, index) => (
              <li
                key={item.id ?? `evidence-${index}`}
                className="rounded-lg border p-3 space-y-2"
              >
                <p className="text-sm">{item.description}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.docType && <span>{item.docType}</span>}
                  {item.party && <span>· {item.party}</span>}
                  {item.date && <span>· {item.date}</span>}
                  {item.sourceDocumentId && (
                    <Link
                      href={`/app/matters/${matterId}?tab=documents&doc=${item.sourceDocumentId}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      Source document
                    </Link>
                  )}
                </div>
                <EvidenceFlagBadges item={item} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
