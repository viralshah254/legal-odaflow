"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getMatter } from "@/lib/api/matters"
import { listTenantUsers } from "@/lib/api/users"
import { addTimelineEvent } from "@/lib/api/timeline"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2 } from "lucide-react"

interface TransferCaseDialogProps {
  matterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransferComplete: () => void
}

export function TransferCaseDialog({
  matterId,
  open,
  onOpenChange,
  onTransferComplete,
}: TransferCaseDialogProps) {
  const t = useTranslations("matters")
  const tCommon = useTranslations("common")
  const { currentUser, currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const user = currentUser ?? { id: "", name: "User", email: "" }
  const [newOwnerId, setNewOwnerId] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [keepAsWatcher, setKeepAsWatcher] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { data: matter } = useApiData(
    ["matter-transfer", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && open,
    },
  )

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users-transfer", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId && open,
    },
  )

  if (!matter) return null

  const availableUsers = tenantUsers.filter(
    (tu) =>
      tu.userId !== user.id &&
      (currentRole === "PARTNER_ADMIN" || tu.role !== "FIRM_ADMIN"),
  )

  const handleTransfer = async () => {
    if (!newOwnerId || !matter || !activeTenantId) return
    const newOwner = tenantUsers.find((tu) => tu.userId === newOwnerId)
    if (!newOwner) return

    setSubmitting(true)
    try {
      await addTimelineEvent(activeTenantId, {
        matterId,
        type: "CASE_TRANSFERRED",
        title: t("case_transferred"),
        description: t("transferred_to", { name: newOwner.user.name ?? newOwner.user.email }),
        metadata: {
          toUserId: newOwnerId,
          toUserName: newOwner.user.name ?? newOwner.user.email,
          reason,
          keepAsWatcher,
        },
      })
      onTransferComplete()
      onOpenChange(false)
      setNewOwnerId("")
      setReason("")
      setKeepAsWatcher(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("transfer_case")}</DialogTitle>
          <DialogDescription>
            {t("transfer_case_description", { title: matter.title })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-owner">{t("new_owner")}</Label>
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger id="new-owner">
                <SelectValue placeholder={t("select_new_owner")} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((tu) => (
                  <SelectItem key={tu.userId} value={tu.userId}>
                    {tu.user.name ?? tu.user.email} ({tu.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">{t("reason_for_transfer")}</Label>
            <Textarea
              id="reason"
              placeholder={t("explain_transfer_reason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="watcher"
              checked={keepAsWatcher}
              onCheckedChange={(checked) => setKeepAsWatcher(checked === true)}
            />
            <Label htmlFor="watcher" className="text-sm font-normal cursor-pointer">
              {t("keep_as_watcher")}
            </Label>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              {t("transfer_ownership_warning")}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleTransfer} disabled={!newOwnerId || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("transferring")}
              </>
            ) : (
              t("transfer_case")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
