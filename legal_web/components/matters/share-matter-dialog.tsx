"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Lock, Edit } from "lucide-react"
import {
  listMatterShares,
  shareMatter,
  removeMatterShare,
  updateMatterShareAccess,
  type ApiMatterShare,
} from "@/lib/api/matter-access"
import { listTenantUsers } from "@/lib/api/users"
import type { MatterAccessLevel } from "@/lib/types/matter-sharing"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { format, parseISO } from "date-fns"

interface ShareMatterDialogProps {
  matterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onShareComplete: () => void
}

export function ShareMatterDialog({ matterId, open, onOpenChange, onShareComplete }: ShareMatterDialogProps) {
  const t = useTranslations("matters")
  const tCommon = useTranslations("common")
  const { currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [accessLevel, setAccessLevel] = useState<MatterAccessLevel>("READ_ONLY")
  const [shares, setShares] = useState<ApiMatterShare[]>([])
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !activeTenantId) return
    setLoading(true)
    Promise.all([
      listMatterShares(activeTenantId, matterId),
      listTenantUsers(activeTenantId),
    ])
      .then(([shareList, users]) => {
        setShares(shareList)
        setTeamUsers(
          users
            .filter((m) => m.user.id !== currentUser?.id)
            .map((m) => ({
              id: m.user.id,
              name: m.user.name ?? m.user.email,
              role: m.role,
            })),
        )
      })
      .catch(() => {
        setShares([])
        setTeamUsers([])
      })
      .finally(() => setLoading(false))
  }, [matterId, open, activeTenantId, currentUser?.id])

  const handleShare = async () => {
    if (!selectedUserId || !currentUser || !activeTenantId) return
    await shareMatter(activeTenantId, matterId, { userId: selectedUserId, accessLevel })
    const updated = await listMatterShares(activeTenantId, matterId)
    setShares(updated)
    setSelectedUserId("")
    setAccessLevel("READ_ONLY")
    onShareComplete()
  }

  const handleRemoveShare = async (userId: string) => {
    if (!activeTenantId) return
    await removeMatterShare(activeTenantId, matterId, userId)
    setShares(await listMatterShares(activeTenantId, matterId))
    onShareComplete()
  }

  const handleUpdateAccess = async (userId: string, newLevel: MatterAccessLevel) => {
    if (!activeTenantId) return
    await updateMatterShareAccess(activeTenantId, matterId, userId, newLevel)
    setShares(await listMatterShares(activeTenantId, matterId))
    onShareComplete()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("share_matter")}</DialogTitle>
          <DialogDescription>{t("grant_access_to_team_members_with_read-only_or_write_permiss")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="user">{t("select_user")}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("choose_a_team_member")} />
                </SelectTrigger>
                <SelectContent>
                  {teamUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access">{t("access_level")}</Label>
              <Select value={accessLevel} onValueChange={(value) => setAccessLevel(value as MatterAccessLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READ_ONLY">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>{t("read_only_-_view_only_no_edits")}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="WRITE">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      <span>{t("write_-_can_edit_and_update")}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleShare} disabled={!selectedUserId || loading} className="w-full">
              {t("share_matter_button")}
            </Button>
          </div>

          {shares.length > 0 && (
            <div className="space-y-2">
              <Label>{t("shared_with")}</Label>
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{share.userName ?? share.userId}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("shared_by_on", {
                            name: share.sharedByName ?? share.sharedBy,
                            date: format(parseISO(share.sharedAt), "MMM d, yyyy"),
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={share.accessLevel}
                        onValueChange={(value) =>
                          handleUpdateAccess(share.userId, value as MatterAccessLevel)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="READ_ONLY">{t("read_only")}</SelectItem>
                          <SelectItem value="WRITE">{t("write")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveShare(share.userId)}
                        className="text-destructive"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
