"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  masterDeleteAdminUser,
  setAdminUserActive,
  type AdminUser,
} from "@/lib/api/admin"
import { useAuth } from "@/lib/contexts/auth-context"
import { Loader2 } from "lucide-react"

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1 py-2 border-b border-border/60 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  )
}

function authMethodLabel(method: string): string {
  switch (method) {
    case "firebase":
      return "Google / Apple (Firebase)"
    case "firebase_and_password":
      return "Firebase + email password"
    case "email_password":
      return "Email & password"
    case "invitation":
      return "Firm invitation"
    default:
      return method
  }
}

interface AdminUserDetailSheetProps {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserUpdated?: () => void
}

export function AdminUserDetailSheet({
  user,
  open,
  onOpenChange,
  onUserUpdated,
}: AdminUserDetailSheetProps) {
  const { user: currentUser } = useAuth()
  const firm = user?.tenantUsers?.[0]?.tenant

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("")

  const isSelf = user?.id === currentUser?.id
  const isSuperAdmin = user?.userType === "SUPER_ADMIN"
  const canManage = !!user && !isSuperAdmin && !isSelf

  const resetActionState = () => {
    setActionError(null)
    setDeleteConfirmEmail("")
  }

  const handleToggleActive = async () => {
    if (!user || !canManage) return
    try {
      setActionLoading(true)
      setActionError(null)
      await setAdminUserActive(user.id, !user.isActive)
      onUserUpdated?.()
      onOpenChange(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionLoading(false)
    }
  }

  const handleMasterDelete = async () => {
    if (!user || !canManage) return
    try {
      setActionLoading(true)
      setActionError(null)
      await masterDeleteAdminUser(user.id, deleteConfirmEmail)
      setDeleteOpen(false)
      onOpenChange(false)
      onUserUpdated?.()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) resetActionState()
          onOpenChange(next)
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {user ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {user.name ?? user.email}
                  <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </SheetTitle>
                <SheetDescription>{user.email}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Signup profile
                  </h3>
                  <dl>
                    <DetailRow label="Account type" value={user.userType} />
                    <DetailRow label="Full name" value={user.name} />
                    <DetailRow label="Phone" value={user.phone} />
                    <DetailRow label="Country" value={user.countryCode} />
                    <DetailRow
                      label="Region / jurisdiction"
                      value={
                        user.jurisdiction ??
                        user.consumerProfile?.stateOrCounty ??
                        undefined
                      }
                    />
                    <DetailRow label="Sign-up method" value={authMethodLabel(user.authMethod)} />
                    <DetailRow
                      label="Joined"
                      value={new Date(user.createdAt).toLocaleString()}
                    />
                    <DetailRow
                      label="First login"
                      value={
                        user.firstLoginAt
                          ? new Date(user.firstLoginAt).toLocaleString()
                          : undefined
                      }
                    />
                  </dl>
                </section>

                {user.userType === "LAWYER" && firm ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Firm (signup)
                    </h3>
                    <dl>
                      <DetailRow label="Firm name" value={firm.name} />
                      <DetailRow label="Firm country" value={firm.primaryCountry} />
                      <DetailRow label="Billing plan" value={firm.billingPlan ?? "—"} />
                      <DetailRow
                        label="Subscription status"
                        value={firm.subscription?.status ?? "—"}
                      />
                      <DetailRow label="Plan ID" value={firm.subscription?.planId} />
                      <DetailRow
                        label="Renewal date"
                        value={
                          firm.subscription?.currentPeriodEnd
                            ? new Date(firm.subscription.currentPeriodEnd).toLocaleDateString(
                                "en-GB",
                                { day: "2-digit", month: "short", year: "numeric" },
                              )
                            : undefined
                        }
                      />
                      <DetailRow
                        label="Credits remaining"
                        value={
                          firm.aiCreditsRemaining != null
                            ? firm.aiCreditsRemaining.toLocaleString()
                            : undefined
                        }
                      />
                      <DetailRow
                        label="Role"
                        value={user.tenantUsers?.map((tu) => tu.role).join(", ")}
                      />
                    </dl>
                  </section>
                ) : null}

                {user.consumerProfile ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Consumer account
                    </h3>
                    <dl>
                      <DetailRow
                        label="Subscription"
                        value={user.consumerProfile.subscriptionStatus}
                      />
                      <DetailRow
                        label="Credits remaining"
                        value={
                          user.consumerProfile.aiCreditsRemaining != null
                            ? user.consumerProfile.aiCreditsRemaining.toLocaleString()
                            : undefined
                        }
                      />
                      <DetailRow
                        label="Preferred language"
                        value={user.consumerProfile.preferredLanguage}
                      />
                    </dl>
                  </section>
                ) : null}

                {user.lawyerProfile ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Lawyer profile
                    </h3>
                    <dl>
                      <DetailRow
                        label="Marketplace"
                        value={
                          user.lawyerProfile.verified ? (
                            <Badge variant="outline" className="text-emerald-600">
                              Verified
                            </Badge>
                          ) : (
                            user.lawyerProfile.verificationStatus
                          )
                        }
                      />
                      <DetailRow label="Bar number" value={user.lawyerProfile.barNumber} />
                      <DetailRow
                        label="Practice areas"
                        value={
                          user.lawyerProfile.practiceAreas.length > 0
                            ? user.lawyerProfile.practiceAreas.join(", ")
                            : undefined
                        }
                      />
                      <DetailRow
                        label="Accepts leads"
                        value={user.lawyerProfile.acceptsLeads ? "Yes" : "No"}
                      />
                    </dl>
                  </section>
                ) : null}

                {user.referral ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Referral
                    </h3>
                    <dl>
                      <DetailRow label="Referral code" value={user.referral.code} />
                      <DetailRow label="Status" value={user.referral.status} />
                      <DetailRow
                        label="Referred by"
                        value={
                          user.referral.referrerName
                            ? `${user.referral.referrerName} (${user.referral.referrerEmail})`
                            : user.referral.referrerEmail
                        }
                      />
                    </dl>
                  </section>
                ) : null}

                {user.invitationStatus ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Invitation
                    </h3>
                    <dl>
                      <DetailRow label="Status" value={user.invitationStatus} />
                      <DetailRow
                        label="Invited"
                        value={
                          user.invitedAt
                            ? new Date(user.invitedAt).toLocaleString()
                            : undefined
                        }
                      />
                      <DetailRow
                        label="Accepted"
                        value={
                          user.invitationAcceptedAt
                            ? new Date(user.invitationAcceptedAt).toLocaleString()
                            : undefined
                        }
                      />
                    </dl>
                  </section>
                ) : null}

                <section className="rounded-lg border border-border/80 p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Activity
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    See this user&apos;s research queries, drafts, copilot prompts, and searches.
                  </p>
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/admin/user-activity?userId=${encodeURIComponent(user.id)}`}>
                      View activity
                    </Link>
                  </Button>
                </section>

                <section className="rounded-lg border border-border/80 p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Account actions
                  </h3>
                  {isSelf ? (
                    <p className="text-xs text-muted-foreground">
                      You cannot deactivate or delete your own admin account.
                    </p>
                  ) : isSuperAdmin ? (
                    <p className="text-xs text-muted-foreground">
                      Super admin accounts cannot be deactivated or deleted from this panel.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Deactivating blocks sign-in and revokes active sessions. Master delete
                        permanently removes the user and their personal data from the platform.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={actionLoading}
                          onClick={handleToggleActive}
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.isActive ? (
                            "Deactivate user"
                          ) : (
                            "Reactivate user"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={actionLoading}
                          onClick={() => {
                            setActionError(null)
                            setDeleteConfirmEmail("")
                            setDeleteOpen(true)
                          }}
                        >
                          Master delete
                        </Button>
                      </div>
                    </>
                  )}
                  {actionError ? (
                    <p className="text-sm text-destructive">{actionError}</p>
                  ) : null}
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Master delete user</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">{user?.email}</span> and their
              personal account data. This cannot be undone. Firm/tenant data created by this user
              may remain for other members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm-email">
              Type <span className="font-mono text-xs">{user?.email}</span> to confirm
            </Label>
            <Input
              id="delete-confirm-email"
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={user?.email ?? ""}
              autoComplete="off"
            />
          </div>
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                actionLoading ||
                deleteConfirmEmail.trim().toLowerCase() !== user?.email.toLowerCase()
              }
              onClick={handleMasterDelete}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting…
                </>
              ) : (
                "Delete permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
