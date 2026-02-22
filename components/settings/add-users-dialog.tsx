"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addUsersToSubscription, getCurrentSubscription } from "@/lib/mock/subscription"
import { calculateProRataAmount } from "@/lib/utils/billing"
import { formatCurrencyWithSymbol } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { Users, Plus, Minus } from "lucide-react"

interface AddUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUsersAdded: () => void
}

export function AddUsersDialog({ open, onOpenChange, onUsersAdded }: AddUsersDialogProps) {
  const { currency } = useCurrency()
  const subscription = getCurrentSubscription()
  const [additionalUsers, setAdditionalUsers] = useState(1)

  if (!subscription) {
    return null
  }

  const proRataAmount = calculateProRataAmount(
    subscription.pricePerUser,
    additionalUsers,
    subscription.billingCycle
  )

  const handleAddUsers = () => {
    if (additionalUsers <= 0) return

    const result = addUsersToSubscription(additionalUsers)
    onUsersAdded()
    onOpenChange(false)
    setAdditionalUsers(1)
    
    // Show success message
    alert(
      `Successfully added ${additionalUsers} user(s)!\n` +
      `Pro-rata charge: ${subscription.currencySymbol}${proRataAmount.toFixed(2)}\n` +
      `New total users: ${result.newUserCount}`
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Users to Subscription</DialogTitle>
          <DialogDescription>
            Add additional users to your subscription. You'll be charged a pro-rata amount for the remaining billing period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Users</Label>
            <p className="text-sm text-muted-foreground">{subscription.userCount} user{subscription.userCount !== 1 ? "s" : ""}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional-users">Additional Users</Label>
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
                <span className="text-sm text-muted-foreground">New Total Users</span>
                <span className="font-semibold">{subscription.userCount + additionalUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pro-Rata Charge</span>
                <span className="font-bold text-lg">
                  {subscription.currencySymbol}
                  {proRataAmount.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  This covers the remaining {subscription.billingCycle === "monthly" ? "days of this month" : "days of this year"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> The pro-rata charge will be applied immediately. Your next regular billing will include all users at the full rate.
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




