"use client"

import type { ActionProposal } from "@/lib/types/copilot"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, Edit, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionProposalCardProps {
  proposal: ActionProposal
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onReview?: (id: string) => void
  onEdit?: (id: string) => void
  canApprove?: boolean
}

export function ActionProposalCard({
  proposal,
  onApprove,
  onReject,
  onReview,
  onEdit,
  canApprove = false,
}: ActionProposalCardProps) {
  const isPending = proposal.status === "proposed"
  const isExecuted = proposal.status === "executed"
  const isRejected = proposal.status === "rejected"

  return (
    <Card className={cn("border-l-4", proposal.requiresApproval && "border-l-amber-500")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{proposal.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{proposal.description}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {proposal.requiresApproval && (
              <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-xs">
                <Shield className="h-3 w-3 mr-0.5" />
                Requires approval
              </Badge>
            )}
            <Badge variant={isExecuted ? "default" : isRejected ? "destructive" : "secondary"} className="text-xs">
              {proposal.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {proposal.reasoning && (
          <p className="text-xs text-muted-foreground">{proposal.reasoning}</p>
        )}
        {proposal.affectedRecords?.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Affected: {proposal.affectedRecords.map((r) => r.label).join(", ")}
          </div>
        )}
        {proposal.auditId && (
          <p className="text-xs text-muted-foreground">Audit: {proposal.auditId}</p>
        )}
        {isPending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onReview && (
              <Button variant="outline" size="sm" onClick={() => onReview(proposal.id)}>
                Review
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(proposal.id)}>
                <Edit className="h-3.5 w-3 mr-1" />
                Edit
              </Button>
            )}
            {canApprove && onApprove && (
              <Button size="sm" onClick={() => onApprove(proposal.id)}>
                <Check className="h-3.5 w-3 mr-1" />
                Approve
              </Button>
            )}
            {onReject && (
              <Button variant="destructive" size="sm" onClick={() => onReject(proposal.id)}>
                <X className="h-3.5 w-3 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
