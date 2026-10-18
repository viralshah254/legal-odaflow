"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { calculateProRataAmount } from "@/lib/utils/billing"
import { useTenant } from "@/lib/contexts/tenant-context"
import { billingPlanToTier } from "@/lib/utils/plan-from-tenant"
import { useBillingDisplay } from "@/lib/hooks/use-billing-display"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listTenantUsers } from "@/lib/api/users"
import { Plus, Minus } from "lucide-react"

interface AddUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUsersAdded: () => void
}

export function AddUsersDialog({ open, onOpenChange, onUsersAdded }: AddUsersDialogProps) {
  const t = useTranslations("settings")
  const tLawyer = useTranslations("lawyer")
  const { activeTenant, activeTenantId } = useTenant()
  const { pricePerUser, formatAmount } = useBillingDisplay()
  const [additionalUsers, setAdditionalUsers] = useState(1)

  const plan = billingPlanToTier(activeTenant?.tenant.billingPlan)

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId && open,
    },
  )

  const userCount = tenantUsers.length

  if (!activeTenantId || !plan) {
    return null
  }

  const newTotalUsers = userCount + additionalUsers
  const proRataAmount = calculateProRataAmount(pricePerUser, additionalUsers, "monthly")
  const nextMonthlyBill = pricePerUser * newTotalUsers

  const handleAddUsers = () => {
    if (additionalUsers <= 0) return
    onUsersAdded()
    onOpenChange(false)
    setAdditionalUsers(1)
    alert(
      `Request to add ${additionalUsers} user(s) noted.\n` +
      `Estimated pro-rata charge: ${formatAmount(proRataAmount)}\n` +
      `Next monthly bill: ${formatAmount(nextMonthlyBill)}\n` +
      `New total users: ${newTotalUsers}`,
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("add_users_to_subscription")}</DialogTitle>
          <DialogDescription>
            Add additional users to your subscription. You'll be charged a pro-rata amount for the remaining billing period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("current_users")}</Label>
            <p className="text-sm text-muted-foreground">{userCount} user{userCount !== 1 ? "s" : ""}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional-users">{t("additional_users")}</Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdditionalUsers(Math.max(1, additionalUsers - 1))}
                disabled={additionalUsers <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="additional-users"
                type="number"
                min="1"
                value={additionalUsers}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1
                  setAdditionalUsers(Math.max(1, val))
                }}
                className="text-center text-lg font-semibold"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAdditionalUsers(additionalUsers + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("new_total_users")}</span>
                <span className="font-semibold">{newTotalUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("pro-rata_charge")}</span>
                <span className="font-bold text-lg">
                  {formatAmount(proRataAmount)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("pro_rata_covers_remaining_days")}
              </p>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">{t("next_monthly_bill")}</p>
                  <p className="text-xs text-muted-foreground">{t("from_next_billing_period")}</p>
                </div>
                <span className="font-semibold text-lg">
                  {formatAmount(nextMonthlyBill)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              <strong>{tLawyer("note")}</strong> The pro-rata charge will be applied immediately. Your next regular billing will include all users at the full rate.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddUsers}>
            Add {additionalUsers} User{additionalUsers !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
