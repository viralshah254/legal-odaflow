"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  Coins,
  RefreshCcw,
  Ban,
  Infinity,
  ShieldAlert,
  CreditCard,
  XCircle,
  Mail,
} from "lucide-react"
import {
  type ApiTenantUser,
  type UserCreditUsage,
  type BillingStatus,
  getUserCreditUsage,
  updateTenantUser,
} from "@/lib/api/users"
import { mapTenantRoleToUserRole } from "@/lib/auth/role-mapper"
import { CreditUsageBar } from "./CreditUsageBar"
import { cn } from "@/lib/utils"

const roleDisplayNames: Record<string, string> = {
  PARTNER_ADMIN: "Partner (Admin)",
  JUNIOR_PARTNER: "Junior Partner",
  ASSOCIATE: "Associate",
  PARALEGAL: "Paralegal",
  FINANCE: "Finance",
  INTAKE: "Intake",
  OPS_HR: "Ops/HR",
  RECEPTION: "Reception",
  READ_ONLY: "Read-Only",
}

const billingStatusColors: Record<BillingStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  SUSPENDED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  EXEMPT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}

function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", destructive = false, loading = false, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface MemberDetailSheetProps {
  tenantId: string
  member: ApiTenantUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin?: boolean
}

export function MemberDetailSheet({
  tenantId, member, open, onOpenChange, isAdmin = false,
}: MemberDetailSheetProps) {
  const queryClient = useQueryClient()
  const [creditUsage, setCreditUsage] = useState<UserCreditUsage | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [newLimit, setNewLimit] = useState("")
  const [updatingLimit, setUpdatingLimit] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resettingCycle, setResettingCycle] = useState(false)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [updatingBillingStatus, setUpdatingBillingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !member) { setCreditUsage(null); return }
    setLoadingCredits(true)
    getUserCreditUsage(tenantId, member.userId)
      .then(setCreditUsage)
      .catch(() => setCreditUsage(null))
      .finally(() => setLoadingCredits(false))
  }, [open, member, tenantId])

  if (!member) return null

  const displayName = member.user.name ?? "User"
  const userRole = mapTenantRoleToUserRole(member.role)
  const billingStatus = (member.billingStatus ?? "ACTIVE") as BillingStatus
  const invStatus = member.user.invitationStatus

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] })
    await queryClient.invalidateQueries({ queryKey: ["team-credit-usage", tenantId] })
  }

  const refreshCredits = async () => {
    try {
      const fresh = await getUserCreditUsage(tenantId, member.userId)
      setCreditUsage(fresh)
    } catch { /* silent */ }
  }

  const handleSetLimit = async (limit: number | null) => {
    setUpdatingLimit(true); setError(null)
    try {
      await updateTenantUser(tenantId, member.userId, { monthlyCreditLimit: limit })
      await invalidate()
      await refreshCredits()
      setNewLimit("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update limit")
    } finally { setUpdatingLimit(false) }
  }

  const handleResetCycle = async () => {
    setResettingCycle(true); setError(null)
    try {
      await updateTenantUser(tenantId, member.userId, { resetCreditCycle: true })
      await invalidate()
      await refreshCredits()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reset cycle")
    } finally { setResettingCycle(false); setResetConfirm(false) }
  }

  const handleBillingStatus = async (status: BillingStatus) => {
    setUpdatingBillingStatus(true); setError(null)
    try {
      await updateTenantUser(tenantId, member.userId, { billingStatus: status })
      await invalidate()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update billing status")
    } finally { setUpdatingBillingStatus(false) }
  }

  const handleDeactivate = async () => {
    setDeactivating(true); setError(null)
    try {
      await updateTenantUser(tenantId, member.userId, { status: "INACTIVE" })
      await invalidate()
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to deactivate member")
    } finally { setDeactivating(false); setDeactivateConfirm(false) }
  }

  const initials = displayName
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-4 pt-2">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-xl leading-tight">{displayName}</SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {member.user.email}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5 pb-8">
            {/* Identity badges */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm px-2.5 py-1 rounded-full bg-muted font-medium">
                {roleDisplayNames[userRole] ?? member.role}
              </span>
              {member.displayTitle && (
                <span className="text-sm text-muted-foreground">{member.displayTitle}</span>
              )}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                billingStatusColors[billingStatus]
              )}>
                {billingStatus}
              </span>
              {member.isBillableSeat ? (
                <Badge variant="outline" className="text-xs gap-1">
                  <CreditCard className="h-3 w-3" /> Billable seat
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Non-billable</Badge>
              )}
              {invStatus === "PENDING" && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  Invitation pending
                </span>
              )}
              {member.user.isActive === false && (
                <Badge variant="destructive" className="text-xs">Inactive</Badge>
              )}
            </div>

            <Separator />

            {/* AI Credits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">AI Credit Usage</h3>
              </div>

              {loadingCredits ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : creditUsage ? (
                <div className="space-y-3">
                  <CreditUsageBar
                    used={creditUsage.used}
                    limit={creditUsage.limit}
                    status={creditUsage.status}
                    cycleEnd={creditUsage.cycleEnd}
                  />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-muted-foreground mb-0.5">Current cycle</p>
                      <p className="font-medium">
                        {new Date(creditUsage.cycleStart).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(creditUsage.cycleEnd).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-muted-foreground mb-0.5">Firm wallet</p>
                      <p className="font-medium">{creditUsage.tenantCreditsRemaining.toLocaleString()} left</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adjust monthly limit</p>
                        <div className="flex gap-2 flex-wrap">
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 500"
                            value={newLimit}
                            onChange={(e) => setNewLimit(e.target.value)}
                            className="w-28 h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!newLimit || updatingLimit}
                            onClick={() => handleSetLimit(parseInt(newLimit, 10))}
                            className="h-8"
                          >
                            {updatingLimit ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set cap"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updatingLimit}
                            onClick={() => handleSetLimit(null)}
                            className="h-8 gap-1"
                          >
                            <Infinity className="h-3.5 w-3.5" /> Unlimited
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updatingLimit}
                            onClick={() => handleSetLimit(0)}
                            className="h-8 text-destructive gap-1 hover:text-destructive"
                          >
                            <Ban className="h-3.5 w-3.5" /> Block AI
                          </Button>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 w-full"
                        onClick={() => setResetConfirm(true)}
                        disabled={resettingCycle}
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Reset credit cycle
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Credit usage unavailable</p>
              )}
            </div>

            {isAdmin && (
              <>
                <Separator />

                {/* Billing status */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Billing status</h3>
                  </div>
                  <Select
                    value={billingStatus}
                    onValueChange={(v) => handleBillingStatus(v as BillingStatus)}
                    disabled={updatingBillingStatus}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="EXEMPT">Exempt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Danger zone */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    <h3 className="font-semibold text-sm text-destructive">Danger zone</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full gap-1.5"
                    onClick={() => setDeactivateConfirm(true)}
                    disabled={deactivating || member.user.isActive === false}
                  >
                    <XCircle className="h-4 w-4" />
                    Deactivate member
                  </Button>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={resetConfirm}
        onOpenChange={setResetConfirm}
        title="Reset credit cycle?"
        description={`This starts a fresh monthly usage window for ${displayName} from today. Their used credits reset to 0 for the new cycle. This cannot be undone.`}
        confirmLabel="Reset cycle"
        loading={resettingCycle}
        onConfirm={() => void handleResetCycle()}
      />

      <ConfirmDialog
        open={deactivateConfirm}
        onOpenChange={setDeactivateConfirm}
        title={`Deactivate ${displayName}?`}
        description="This will revoke their access to the firm workspace immediately. Their data is preserved. You can reactivate them later from Settings › Users."
        confirmLabel="Deactivate"
        destructive
        loading={deactivating}
        onConfirm={() => void handleDeactivate()}
      />
    </>
  )
}
