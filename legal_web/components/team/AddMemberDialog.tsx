"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Link2, Ban, Infinity, Coins } from "lucide-react"
import { createTenantUser, type ApiTenantUser, type SpecialtyLevel, type SeatPlan } from "@/lib/api/users"
import { mapUserRoleToTenantRole } from "@/lib/auth/role-mapper"
import { ASSIGNABLE_FIRM_USER_ROLES } from "@/lib/auth/role-mapper"
import { type UserRole } from "@/lib/types/roles"
import { ApiClientError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const roleDisplayNames: Record<UserRole, string> = {
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

const ROLE_DEFAULT_PLAN: Record<UserRole, SeatPlan> = {
  PARTNER_ADMIN: "PROFESSIONAL",
  JUNIOR_PARTNER: "PROFESSIONAL",
  ASSOCIATE: "STARTER",
  PARALEGAL: "STARTER",
  FINANCE: "STARTER",
  INTAKE: "STARTER",
  OPS_HR: "STARTER",
  RECEPTION: "STARTER",
  READ_ONLY: "STARTER",
}

interface AddMemberDialogProps {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (member: ApiTenantUser & { invitationUrl?: string }) => void
}

type CreditMode = "unlimited" | "capped" | "blocked"

export function AddMemberDialog({ tenantId, open, onOpenChange, onSuccess }: AddMemberDialogProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("ASSOCIATE")
  const [creditMode, setCreditMode] = useState<CreditMode>("unlimited")
  const [creditCap, setCreditCap] = useState("200")
  const [isBillableSeat, setIsBillableSeat] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitationResult, setInvitationResult] = useState<{ url: string; expiresAt?: string } | null>(null)

  useEffect(() => {
    if (!open) {
      setName(""); setEmail(""); setRole("ASSOCIATE")
      setCreditMode("unlimited"); setCreditCap("200"); setIsBillableSeat(true)
      setError(null); setInvitationResult(null); setSubmitting(false)
    }
  }, [open])

  const monthlyCreditLimit = (): number | null => {
    if (creditMode === "blocked") return 0
    if (creditMode === "capped") return Math.max(0, parseInt(creditCap, 10) || 0)
    return null
  }

  const canSubmit = !!name.trim() && !!email.trim() && !submitting && !invitationResult

  const handleSend = async () => {
    const tenantRole = mapUserRoleToTenantRole(role)
    if (!tenantRole || !canSubmit) return
    setSubmitting(true); setError(null)
    try {
      const result = await createTenantUser(tenantId, {
        name: name.trim(),
        email: email.trim(),
        role: tenantRole,
        monthlyCreditLimit: monthlyCreditLimit(),
        isBillableSeat,
        seatPlan: ROLE_DEFAULT_PLAN[role],
      })
      await queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] })
      if (result.invitationUrl) {
        setInvitationResult({ url: result.invitationUrl, expiresAt: result.invitationExpiresAt })
      } else {
        onSuccess?.(result)
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send invitation")
    } finally {
      setSubmitting(false)
    }
  }

  const creditLabel: Record<CreditMode, string> = {
    unlimited: "Unlimited (draws from firm wallet)",
    capped: `Monthly cap — ${creditCap || "?"} credits`,
    blocked: "AI access blocked",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            An invitation link will be emailed. The member sets their own password.
          </DialogDescription>
        </DialogHeader>

        {invitationResult ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 space-y-2">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Invitation created
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Copy the link below and share it — or it will be sent by email.
              </p>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={invitationResult.url}
                  className="text-xs font-mono bg-white dark:bg-gray-900"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(invitationResult.url)}
                >
                  Copy
                </Button>
              </div>
              {invitationResult.expiresAt && (
                <p className="text-[10px] text-muted-foreground">
                  Expires {new Date(invitationResult.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name">Full name</Label>
                  <Input id="inv-name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-email">Email</Label>
                  <Input id="inv-email" type="email" placeholder="jane@firm.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-role">Firm role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger id="inv-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_FIRM_USER_ROLES.map((key) => (
                      <SelectItem key={key} value={key}>{roleDisplayNames[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* AI Credit Allocation */}
              <div className="space-y-2">
                <Label>Monthly AI credits</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["unlimited", "capped", "blocked"] as CreditMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCreditMode(mode)}
                      className={cn(
                        "rounded-lg border-2 p-2.5 text-left transition-all text-xs",
                        creditMode === mode
                          ? mode === "blocked"
                            ? "border-destructive bg-destructive/5"
                            : "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {mode === "unlimited" && <Infinity className="h-3.5 w-3.5" />}
                        {mode === "capped" && <Coins className="h-3.5 w-3.5" />}
                        {mode === "blocked" && <Ban className="h-3.5 w-3.5 text-destructive" />}
                        <span className={cn("font-medium capitalize", mode === "blocked" && "text-destructive")}>{mode}</span>
                      </div>
                      <p className="text-muted-foreground leading-tight">
                        {mode === "unlimited" && "Draws from firm wallet"}
                        {mode === "capped" && "Set a monthly cap"}
                        {mode === "blocked" && "No AI access"}
                      </p>
                    </button>
                  ))}
                </div>
                {creditMode === "capped" && (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={1}
                      value={creditCap}
                      onChange={(e) => setCreditCap(e.target.value)}
                      className="w-28"
                      placeholder="200"
                    />
                    <span className="text-sm text-muted-foreground">credits / month</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{creditLabel[creditMode]}</p>
              </div>

              {/* Billable seat */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Billable seat</p>
                  <p className="text-xs text-muted-foreground">Counts toward your firm&apos;s seat subscription</p>
                </div>
                <Switch
                  checked={isBillableSeat}
                  onCheckedChange={setIsBillableSeat}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSend} disabled={!canSubmit}>
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Invitation</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
