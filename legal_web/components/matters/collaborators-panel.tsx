"use client"
import { useTranslations } from "next-intl"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Shield, FileText, Lock } from "lucide-react"
import { getAccessScopeLabel } from "@/lib/types/assistance"

export interface MatterCollaboratorDisplay {
  userName: string
  accessScope: string
}

export interface MatterAccessDisplay {
  id: string
  title: string
  ownerName?: string
  collaborators?: MatterCollaboratorDisplay[]
  watchers?: string[]
}

interface CollaboratorsPanelProps {
  matter: MatterAccessDisplay
  className?: string
}

export function CollaboratorsPanel({ matter, className }: CollaboratorsPanelProps) {
  const t = useTranslations("matters")
  const tCommon = useTranslations("common")
  const collaborators = matter.collaborators || []
  const watchers = matter.watchers || []

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("access_collaborators")}</CardTitle>
        <CardDescription>{t("people_with_access_to_this_matter")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium text-sm">{tCommon("owner")}</div>
              <div className="text-xs text-muted-foreground">{matter.ownerName ?? "—"}</div>
            </div>
          </div>
          <Badge variant="default">{t("full_access")}</Badge>
        </div>

        {collaborators.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("collaborators_count", { count: collaborators.length })}
            </div>
            <div className="space-y-2">
              {collaborators.map((collab, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{collab.userName}</div>
                      <div className="text-xs text-muted-foreground">
                        {getAccessScopeLabel(collab.accessScope as Parameters<typeof getAccessScopeLabel>[0])}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {collab.accessScope === "MATTER_CLIENT_DOCS" && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        {t("docs_badge")}
                      </Badge>
                    )}
                    {collab.accessScope === "FULL_CASE_SUPPORT" && (
                      <>
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {t("docs_badge")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          {t("kyc_badge")}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {watchers.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">{t("watchers_count", { count: watchers.length })}</div>
            <div className="flex flex-wrap gap-2">
              {watchers.map((watcherId) => (
                <Badge key={watcherId} variant="secondary" className="text-xs">
                  {t("user_label", { id: watcherId })}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {collaborators.length === 0 && watchers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("no_collaborators_or_watchers")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
