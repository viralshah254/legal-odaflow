"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Shield, FileText, Lock } from "lucide-react"
import { getAccessScopeLabel } from "@/lib/types/assistance"
import { Matter } from "@/lib/mock/matters"

interface CollaboratorsPanelProps {
  matter: Matter
  className?: string
}

export function CollaboratorsPanel({ matter, className }: CollaboratorsPanelProps) {
  const collaborators = matter.collaborators || []
  const watchers = matter.watchers || []

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Access & Collaborators</CardTitle>
        <CardDescription>People with access to this matter</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Owner */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-medium text-sm">Owner</div>
              <div className="text-xs text-muted-foreground">{matter.ownerName}</div>
            </div>
          </div>
          <Badge variant="default">Full Access</Badge>
        </div>

        {/* Collaborators */}
        {collaborators.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Collaborators ({collaborators.length})
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
                        {getAccessScopeLabel(collab.accessScope)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {collab.accessScope === "MATTER_CLIENT_DOCS" && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        Docs
                      </Badge>
                    )}
                    {collab.accessScope === "FULL_CASE_SUPPORT" && (
                      <>
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          Docs
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          KYC
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watchers */}
        {watchers.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Watchers ({watchers.length})</div>
            <div className="flex flex-wrap gap-2">
              {watchers.map((watcherId) => {
                // In a real app, resolve user name from ID
                return (
                  <Badge key={watcherId} variant="secondary" className="text-xs">
                    User {watcherId}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {collaborators.length === 0 && watchers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No collaborators or watchers
          </p>
        )}
      </CardContent>
    </Card>
  )
}

