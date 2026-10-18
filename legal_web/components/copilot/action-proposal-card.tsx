"use client"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ActionProposal } from "@/lib/types/copilot"

interface ActionProposalCardProps {
  proposal: ActionProposal
  canApprove?: boolean
  onApprove?: () => void
  onReject?: () => void
}

export function ActionProposalCard({
  proposal,
  canApprove = false,
  onApprove,
  onReject,
}: ActionProposalCardProps) {
  const t = useTranslations("copilot")

  return (
    <Card className="border-primary/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          {proposal.label}
          <Badge variant="outline">{proposal.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm text-muted-foreground">{proposal.description}</p>
        {proposal.requiresApproval && proposal.status === "proposed" && canApprove && (
          <div className="flex gap-2">
            <Button size="sm" onClick={onApprove}>
              {t("approve")}
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              {t("reject")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
