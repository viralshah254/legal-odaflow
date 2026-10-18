"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { CreditUsageBar } from "@/components/team/CreditUsageBar"
import { ArrowLeft, UserPlus, Edit, Search, Loader2, Briefcase, ShieldCheck, CreditCard, Zap, Bot, Sparkles, Mail, Infinity, Ban, Coins, RefreshCcw, Link2 } from "lucide-react"
import { type UserRole } from "@/lib/types/roles"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  createTenantUser,
  listTenantUsers,
  updateTenantUser,
  getUserCreditUsage,
  type ApiTenantUser,
  type SpecialtyLevel,
  type SeatPlan,
  type UserCreditUsage,
  type BillingStatus,
} from "@/lib/api/users"
import {
  ASSIGNABLE_FIRM_USER_ROLES,
  mapTenantRoleToUserRole,
  mapUserRoleToTenantRole,
} from "@/lib/auth/role-mapper"
import { ApiClientError } from "@/lib/api/client"
import { ChangeSeatPlanDialog, SEAT_PLANS } from "@/components/settings/change-seat-plan-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { PRACTICE_AREAS } from "@/lib/taxonomy/platform-taxonomy"

const SPECIALTY_LEVELS: SpecialtyLevel[] = ["Junior", "Senior", "Partner", "Consultant"]

const PA_COLORS: Record<string, string> = {
  corporate_commercial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  employment_labour: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  family_matrimonial: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  real_estate_property: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  criminal_defense: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  immigration: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  intellectual_property: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  litigation_disputes: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  private_client_nri: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  international_practice: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  banking_finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  arbitration_adr: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  regulatory_compliance: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  tax: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  wills_estates_probate: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
}

const PA_LABELS: Record<string, string> = Object.fromEntries(
  PRACTICE_AREAS.map((pa) => [pa.slug, pa.label])
)

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

const ROLE_COLORS: Record<UserRole, string> = {
  PARTNER_ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  JUNIOR_PARTNER: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  ASSOCIATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PARALEGAL: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  FINANCE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  INTAKE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  OPS_HR: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  RECEPTION: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  READ_ONLY: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
}

// Role → default job title suggestions
const ROLE_TITLE_SUGGESTIONS: Record<UserRole, string[]> = {
  PARTNER_ADMIN: ["Managing Partner", "Senior Partner", "Partner", "Founding Partner"],
  JUNIOR_PARTNER: ["Partner", "Associate Partner", "Of Counsel"],
  ASSOCIATE: ["Senior Associate", "Associate", "Junior Associate", "Legal Associate"],
  PARALEGAL: ["Senior Paralegal", "Paralegal", "Legal Assistant"],
  FINANCE: ["Finance Manager", "Accounts Manager", "Finance Director", "Chief Financial Officer"],
  INTAKE: ["Intake Coordinator", "Client Relations Manager", "New Business Coordinator"],
  OPS_HR: ["Operations Manager", "HR Manager", "Office Manager"],
  RECEPTION: ["Legal Receptionist", "Front Office Manager", "Administrative Assistant"],
  READ_ONLY: ["Observer", "Auditor", "Compliance Officer"],
}

// Default plan based on role
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

const PLAN_BADGE_STYLES: Record<string, string> = {
  STARTER: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  PROFESSIONAL: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  PRO_PLUS: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <Zap className="h-3 w-3" />,
  PROFESSIONAL: <Bot className="h-3 w-3" />,
  PRO_PLUS: <Sparkles className="h-3 w-3" />,
}

function SeatPlanBadge({ plan }: { plan: string }) {
  const label = SEAT_PLANS.find((p) => p.id === plan)?.label ?? plan
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
      PLAN_BADGE_STYLES[plan] ?? PLAN_BADGE_STYLES.STARTER
    )}>
      {PLAN_ICONS[plan] ?? <Zap className="h-3 w-3" />}
      {label}
    </span>
  )
}

function UserInitials({ name }: { name: string }) {
  return (
    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <span className="text-lg font-semibold text-primary">
        {name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)}
      </span>
    </div>
  )
}

export default function UsersManagementPage() {
  const t = useTranslations("settings")
  const tDashboard = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const { activeTenantId } = useTenant()
  const { user: authUser } = useAuth()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [selectedApiUser, setSelectedApiUser] = useState<ApiTenantUser | null>(null)
  const queryClient = useQueryClient()

  const { data: tenantUsers = [], isLoading, error } = useApiData(
    ["tenant-users", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const filteredUsers = tenantUsers.filter(
    (u) =>
      (u.user.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.displayTitle ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (!activeTenantId) {
    return (
      <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Your firm workspace is still loading.
            </CardContent>
          </Card>
        </div>
      </RoleGate>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Users & Roles
            </h1>
            <p className="text-muted-foreground">
              Manage firm users, roles, practice area specialties, and seat plans
            </p>
          </div>
          <Link href="/app/settings/billing">
            <Button variant="outline" size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </Button>
          </Link>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {error && (
          <Card>
            <CardContent className="py-6 text-destructive">{error.message}</CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search_by_name_email_or_title")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="grid gap-4">
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No users found.
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((tu) => {
              const displayName = tu.user.name ?? "User"
              const userRole = mapTenantRoleToUserRole(tu.role)
              const practiceAreas = (tu.practiceAreas as string[] | undefined) ?? []
              const specialtyLevel = (tu.specialtyLevel as Record<string, SpecialtyLevel> | undefined) ?? {}
              const seatPlan = (tu.seatPlan ?? "STARTER") as SeatPlan

              return (
                <Card key={tu.userId} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <UserInitials name={displayName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{displayName}</h3>
                            {authUser?.id === tu.userId && (
                              <Badge variant="secondary" className="text-xs">{tDashboard("you")}</Badge>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[userRole] ?? "bg-muted text-muted-foreground"}`}>
                              {roleDisplayNames[userRole] ?? tu.role}
                            </span>
                            <SeatPlanBadge plan={seatPlan} />
                          </div>
                          {tu.displayTitle && (
                            <p className="text-sm text-muted-foreground mt-0.5">{tu.displayTitle}</p>
                          )}
                          <p className="text-sm text-muted-foreground">{tu.user.email}</p>
                          {practiceAreas.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {practiceAreas.slice(0, 4).map((slug) => (
                                <span
                                  key={slug}
                                  className={`text-xs px-2 py-0.5 rounded-full ${PA_COLORS[slug] ?? "bg-muted text-muted-foreground"}`}
                                >
                                  {specialtyLevel[slug] ? `${specialtyLevel[slug]} — ` : ""}
                                  {PA_LABELS[slug] ?? slug}
                                </span>
                              ))}
                              {practiceAreas.length > 4 && (
                                <span className="text-xs text-muted-foreground">+{practiceAreas.length - 4} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedApiUser(tu)
                            setChangePlanOpen(true)
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-1.5" />
                          Plan
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedApiUser(tu)
                            setEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        <CreateUserDialog
          tenantId={activeTenantId}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        {selectedApiUser && (
          <EditUserDialog
            tenantId={activeTenantId}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            tenantUser={selectedApiUser}
            onClose={() => {
              setEditDialogOpen(false)
              setSelectedApiUser(null)
            }}
          />
        )}

        {selectedApiUser && (
          <ChangeSeatPlanDialog
            open={changePlanOpen}
            onOpenChange={(v) => { setChangePlanOpen(v); if (!v) setSelectedApiUser(null) }}
            tenantId={activeTenantId}
            userId={selectedApiUser.userId}
            userName={selectedApiUser.user.name ?? "User"}
            currentPlan={(selectedApiUser.seatPlan ?? "STARTER") as SeatPlan}
            onSuccess={(newPlan, proRataAmount) => {
              void queryClient.invalidateQueries({ queryKey: ["tenant-users", activeTenantId] })
              toast({
                title: "Plan updated",
                description: proRataAmount > 0
                  ? `Pro-rated charge of $${proRataAmount} will be applied for the remainder of this cycle.`
                  : "Plan change applied. Takes effect next billing cycle.",
              })
            }}
          />
        )}
      </div>
    </RoleGate>
  )
}

// ─── Practice Area Selector ───────────────────────────────────────────────────

function PracticeAreaSelector({
  selected,
  specialtyLevel,
  onChange,
  onSpecialtyChange,
}: {
  selected: string[]
  specialtyLevel: Record<string, SpecialtyLevel>
  onChange: (selected: string[]) => void
  onSpecialtyChange: (slug: string, level: SpecialtyLevel) => void
}) {
  const t = useTranslations("settings")
  return (
    <div className="space-y-2">
      <Label>{t("practice_areas_specialties")}</Label>
      <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
        {PRACTICE_AREAS.map((pa) => {
          const isSelected = selected.includes(pa.slug)
          return (
            <div key={pa.slug} className="flex items-center gap-3 p-3">
              <Checkbox
                id={`pa-${pa.slug}`}
                checked={isSelected}
                onCheckedChange={(checked) => {
                  if (checked) onChange([...selected, pa.slug])
                  else onChange(selected.filter((s) => s !== pa.slug))
                }}
              />
              <Label htmlFor={`pa-${pa.slug}`} className="flex-1 cursor-pointer font-normal">
                {pa.label}
              </Label>
              {isSelected && (
                <Select
                  value={specialtyLevel[pa.slug] ?? "Associate"}
                  onValueChange={(v) => onSpecialtyChange(pa.slug, v as SpecialtyLevel)}
                >
                  <SelectTrigger className="w-[130px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTY_LEVELS.map((l) => (
                      <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Seat Plan Selector (in-dialog) ───────────────────────────────────────────

function SeatPlanSelector({ value, onChange }: { value: SeatPlan; onChange: (v: SeatPlan) => void }) {
  return (
    <div className="space-y-2">
      <Label>Seat Plan <span className="text-muted-foreground text-xs font-normal">(billed per seat/month)</span></Label>
      <div className="grid grid-cols-3 gap-2">
        {SEAT_PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange(plan.id)}
            className={cn(
              "rounded-lg border-2 p-3 text-left transition-all",
              value === plan.id
                ? plan.id === "PROFESSIONAL"
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : plan.id === "PRO_PLUS"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
                    : "border-gray-400 bg-gray-50 dark:bg-gray-800"
                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            )}
          >
            <div className={cn(
              "inline-flex items-center gap-1 rounded text-xs font-semibold px-1.5 py-0.5 mb-1",
              plan.id === "PROFESSIONAL" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                : plan.id === "PRO_PLUS" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            )}>
              {plan.icon} {plan.label}
            </div>
            <div className="text-xs font-bold text-gray-900 dark:text-white">${plan.monthlyUsd}<span className="font-normal text-muted-foreground">/mo</span></div>
            <div className="text-[10px] text-muted-foreground">{plan.credits.toLocaleString()} credits</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Create User Dialog ───────────────────────────────────────────────────────

type CreditMode = "unlimited" | "capped" | "blocked"

function CreateUserDialog({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const tClients = useTranslations("clients")
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [useInvitation, setUseInvitation] = useState(true)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [role, setRole] = useState<UserRole>("ASSOCIATE")
  const [displayTitle, setDisplayTitle] = useState("")
  const [seatPlan, setSeatPlan] = useState<SeatPlan>("STARTER")
  const [practiceAreas, setPracticeAreas] = useState<string[]>([])
  const [specialtyLevel, setSpecialtyLevel] = useState<Record<string, SpecialtyLevel>>({})
  const [creditMode, setCreditMode] = useState<CreditMode>("unlimited")
  const [creditCap, setCreditCap] = useState("200")
  const [isBillableSeat, setIsBillableSeat] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false)
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)

  useEffect(() => {
    setSeatPlan(ROLE_DEFAULT_PLAN[role] ?? "STARTER")
  }, [role])

  useEffect(() => {
    if (!open) {
      setName(""); setEmail(""); setPassword(""); setConfirmPassword("")
      setRole("ASSOCIATE"); setDisplayTitle(""); setSeatPlan("STARTER")
      setPracticeAreas([]); setSpecialtyLevel({}); setError(null)
      setCreditMode("unlimited"); setCreditCap("200"); setIsBillableSeat(true)
      setUseInvitation(true); setMustChangePassword(false); setInvitationUrl(null)
    }
  }, [open])

  const tenantRole = mapUserRoleToTenantRole(role)
  const passwordsMatch = password === confirmPassword
  const canSubmit = !!name && !!email && !!tenantRole && !submitting && (
    useInvitation || (password.length >= 8 && passwordsMatch)
  )
  const titleSuggestions = ROLE_TITLE_SUGGESTIONS[role] ?? []

  const monthlyCreditLimit = (): number | null => {
    if (creditMode === "blocked") return 0
    if (creditMode === "capped") return Math.max(0, parseInt(creditCap, 10) || 0)
    return null
  }

  const handleSave = async () => {
    if (!canSubmit || !tenantRole) return
    setSubmitting(true); setError(null)
    try {
      const result = await createTenantUser(tenantId, {
        name: name.trim(),
        email: email.trim(),
        role: tenantRole,
        ...(useInvitation ? {} : { password, mustChangePassword }),
        practiceAreas,
        displayTitle: displayTitle.trim() || undefined,
        seatPlan,
        monthlyCreditLimit: monthlyCreditLimit(),
        isBillableSeat,
      })
      await queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] })
      if (result.invitationUrl) {
        setInvitationUrl(result.invitationUrl)
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create user")
    } finally {
      setSubmitting(false)
    }
  }

  if (invitationUrl) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Invitation created
            </DialogTitle>
            <DialogDescription>Share this link with {name} — or it will be delivered by email.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-2">
            <Input readOnly value={invitationUrl} className="text-xs font-mono" />
            <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(invitationUrl)}>Copy</Button>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("add_new_team_member")}</DialogTitle>
          <DialogDescription>
            Create a login for someone on your firm and set their role, plan, and specialties.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("full_name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="displayTitle">{t("job_title")}</Label>
              <Input
                id="displayTitle"
                value={displayTitle}
                onChange={(e) => setDisplayTitle(e.target.value)}
                onFocus={() => setShowTitleSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 150)}
                placeholder={titleSuggestions[0] ?? t("eg_senior_ip_associate")}
              />
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                  {titleSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                      onMouseDown={() => setDisplayTitle(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email_2")}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {/* Onboarding method toggle */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Send invitation link
                </p>
                <p className="text-xs text-muted-foreground">Member sets their own password via a secure link</p>
              </div>
              <Switch checked={useInvitation} onCheckedChange={setUseInvitation} />
            </div>
            {!useInvitation && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("password")}</Label>
                    <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{t("min_8_characters")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t("confirm_password")}</Label>
                    <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    {confirmPassword && !passwordsMatch && (
                      <p className="text-xs text-destructive">{tAuth("passwordsDoNotMatch")}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="mcp" checked={mustChangePassword} onCheckedChange={setMustChangePassword} />
                  <Label htmlFor="mcp" className="font-normal text-sm cursor-pointer">Require password change on first login</Label>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">{t("firm_role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_FIRM_USER_ROLES.map((key) => (
                  <SelectItem key={key} value={key}>{roleDisplayNames[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SeatPlanSelector value={seatPlan} onChange={setSeatPlan} />

          {/* AI Credit allocation */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Coins className="h-4 w-4" />Monthly AI credits</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["unlimited", "capped", "blocked"] as CreditMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCreditMode(mode)}
                  className={cn(
                    "rounded-lg border-2 p-2.5 text-left transition-all text-xs",
                    creditMode === mode
                      ? mode === "blocked" ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-1 mb-0.5 font-medium capitalize">
                    {mode === "unlimited" && <Infinity className="h-3.5 w-3.5" />}
                    {mode === "capped" && <Coins className="h-3.5 w-3.5" />}
                    {mode === "blocked" && <Ban className={cn("h-3.5 w-3.5", mode === "blocked" && "text-destructive")} />}
                    <span className={cn(mode === "blocked" && "text-destructive")}>{mode}</span>
                  </div>
                  <p className="text-muted-foreground leading-tight">
                    {mode === "unlimited" && "From firm wallet"}
                    {mode === "capped" && "Set monthly cap"}
                    {mode === "blocked" && "No AI access"}
                  </p>
                </button>
              ))}
            </div>
            {creditMode === "capped" && (
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={1} value={creditCap} onChange={(e) => setCreditCap(e.target.value)} className="w-28" placeholder="200" />
                <span className="text-sm text-muted-foreground">credits / month</span>
              </div>
            )}
          </div>

          {/* Billable seat */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Billable seat</p>
              <p className="text-xs text-muted-foreground">Counts toward your firm&apos;s seat subscription</p>
            </div>
            <Switch checked={isBillableSeat} onCheckedChange={setIsBillableSeat} />
          </div>

          <PracticeAreaSelector
            selected={practiceAreas}
            specialtyLevel={specialtyLevel}
            onChange={setPracticeAreas}
            onSpecialtyChange={(slug, level) => setSpecialtyLevel((prev) => ({ ...prev, [slug]: level }))}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{tCommon("cancel")}</Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {submitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{tClients("creatingClient")}</>
              : useInvitation
                ? <><Mail className="mr-2 h-4 w-4" />Send Invitation</>
                : "Create User"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit User Dialog ─────────────────────────────────────────────────────────

function EditUserDialog({
  tenantId,
  open,
  onOpenChange,
  tenantUser,
  onClose,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantUser: ApiTenantUser
  onClose: () => void
}) {
  const t = useTranslations("settings")
  const tAdmin = useTranslations("admin")
  const tCommon = useTranslations("common")
  const queryClient = useQueryClient()

  const [name, setName] = useState(tenantUser.user.name ?? "")
  const [role, setRole] = useState<UserRole>(mapTenantRoleToUserRole(tenantUser.role))
  const [displayTitle, setDisplayTitle] = useState(tenantUser.displayTitle ?? "")
  const [practiceAreas, setPracticeAreas] = useState<string[]>(
    (tenantUser.practiceAreas as string[] | undefined) ?? []
  )
  const [specialtyLevel, setSpecialtyLevel] = useState<Record<string, SpecialtyLevel>>(
    (tenantUser.specialtyLevel as Record<string, SpecialtyLevel> | undefined) ?? {}
  )
  const [creditMode, setCreditMode] = useState<CreditMode>(
    tenantUser.monthlyCreditLimit === 0 ? "blocked"
      : tenantUser.monthlyCreditLimit != null ? "capped"
        : "unlimited"
  )
  const [creditCap, setCreditCap] = useState(
    tenantUser.monthlyCreditLimit != null && tenantUser.monthlyCreditLimit > 0
      ? String(tenantUser.monthlyCreditLimit)
      : "200"
  )
  const [isBillableSeat, setIsBillableSeat] = useState(tenantUser.isBillableSeat ?? true)
  const [billingStatus, setBillingStatus] = useState<BillingStatus>((tenantUser.billingStatus as BillingStatus) ?? "ACTIVE")
  const [mustChangePassword, setMustChangePassword] = useState(tenantUser.user.mustChangePassword ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [resettingCycle, setResettingCycle] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false)
  const [creditUsage, setCreditUsage] = useState<UserCreditUsage | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)

  useEffect(() => {
    setName(tenantUser.user.name ?? "")
    setRole(mapTenantRoleToUserRole(tenantUser.role))
    setDisplayTitle(tenantUser.displayTitle ?? "")
    setPracticeAreas((tenantUser.practiceAreas as string[] | undefined) ?? [])
    setSpecialtyLevel((tenantUser.specialtyLevel as Record<string, SpecialtyLevel> | undefined) ?? {})
    setCreditMode(tenantUser.monthlyCreditLimit === 0 ? "blocked" : tenantUser.monthlyCreditLimit != null ? "capped" : "unlimited")
    setCreditCap(tenantUser.monthlyCreditLimit != null && tenantUser.monthlyCreditLimit > 0 ? String(tenantUser.monthlyCreditLimit) : "200")
    setIsBillableSeat(tenantUser.isBillableSeat ?? true)
    setBillingStatus((tenantUser.billingStatus as BillingStatus) ?? "ACTIVE")
    setMustChangePassword(tenantUser.user.mustChangePassword ?? false)
    setError(null)
  }, [tenantUser])

  useEffect(() => {
    if (!open) return
    setLoadingCredits(true)
    getUserCreditUsage(tenantId, tenantUser.userId)
      .then(setCreditUsage)
      .catch(() => setCreditUsage(null))
      .finally(() => setLoadingCredits(false))
  }, [open, tenantId, tenantUser.userId])

  const titleSuggestions = ROLE_TITLE_SUGGESTIONS[role] ?? []

  const monthlyCreditLimit = (): number | null => {
    if (creditMode === "blocked") return 0
    if (creditMode === "capped") return Math.max(0, parseInt(creditCap, 10) || 0)
    return null
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const tenantRole = mapUserRoleToTenantRole(role)
    if (!tenantRole) { setError("This role cannot be assigned yet"); return }
    setSubmitting(true); setError(null)
    try {
      await updateTenantUser(tenantId, tenantUser.userId, {
        name: name.trim(),
        role: tenantRole,
        displayTitle: displayTitle.trim() || undefined,
        practiceAreas,
        specialtyLevel,
        monthlyCreditLimit: monthlyCreditLimit(),
        isBillableSeat,
        billingStatus,
      })
      await queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] })
      onClose()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update user")
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetCycle = async () => {
    setResettingCycle(true); setError(null)
    try {
      await updateTenantUser(tenantId, tenantUser.userId, { resetCreditCycle: true })
      await queryClient.invalidateQueries({ queryKey: ["team-credit-usage", tenantId] })
      const fresh = await getUserCreditUsage(tenantId, tenantUser.userId)
      setCreditUsage(fresh)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reset cycle")
    } finally { setResettingCycle(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("edit_team_member")}</DialogTitle>
          <DialogDescription>Update {tenantUser.user.name ?? "user"}&apos;s role, credit allocation, and billing</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("full_name")}</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="edit-title">{t("job_title")}</Label>
              <Input
                id="edit-title"
                value={displayTitle}
                onChange={(e) => setDisplayTitle(e.target.value)}
                onFocus={() => setShowTitleSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 150)}
                placeholder={titleSuggestions[0] ?? t("eg_head_of_conveyancing")}
              />
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                  {titleSuggestions.map((s) => (
                    <button key={s} type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                      onMouseDown={() => setDisplayTitle(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">{tAdmin("email")}</Label>
            <Input id="edit-email" type="email" value={tenantUser.user.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-role">{t("firm_role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_FIRM_USER_ROLES.map((key) => (
                  <SelectItem key={key} value={key}>{roleDisplayNames[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Current credit usage */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Coins className="h-4 w-4" />Current AI usage</Label>
            {loadingCredits ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : creditUsage ? (
              <div className="space-y-2">
                <CreditUsageBar
                  used={creditUsage.used}
                  limit={creditUsage.limit}
                  status={creditUsage.status}
                  cycleEnd={creditUsage.cycleEnd}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cycle: {new Date(creditUsage.cycleStart).toLocaleDateString("en-US", { day: "numeric", month: "short" })} – {new Date(creditUsage.cycleEnd).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={() => void handleResetCycle()}
                    disabled={resettingCycle}
                  >
                    {resettingCycle ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                    Reset cycle
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Usage data unavailable</p>
            )}
          </div>

          {/* Credit allocation */}
          <div className="space-y-2">
            <Label>Monthly credit limit</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["unlimited", "capped", "blocked"] as CreditMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCreditMode(mode)}
                  className={cn(
                    "rounded-lg border-2 p-2.5 text-left transition-all text-xs",
                    creditMode === mode
                      ? mode === "blocked" ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-1 mb-0.5 font-medium capitalize">
                    {mode === "unlimited" && <Infinity className="h-3.5 w-3.5" />}
                    {mode === "capped" && <Coins className="h-3.5 w-3.5" />}
                    {mode === "blocked" && <Ban className={cn("h-3.5 w-3.5", mode === "blocked" && "text-destructive")} />}
                    <span className={cn(mode === "blocked" && "text-destructive")}>{mode}</span>
                  </div>
                  <p className="text-muted-foreground leading-tight text-[10px]">
                    {mode === "unlimited" && "No per-user cap"}
                    {mode === "capped" && "Monthly cap"}
                    {mode === "blocked" && "No AI access"}
                  </p>
                </button>
              ))}
            </div>
            {creditMode === "capped" && (
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={1} value={creditCap} onChange={(e) => setCreditCap(e.target.value)} className="w-28" placeholder="200" />
                <span className="text-sm text-muted-foreground">credits / month</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Billing settings */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5"><CreditCard className="h-4 w-4" />Billing settings</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Billable seat</p>
                <p className="text-xs text-muted-foreground">Counts toward your firm&apos;s seat subscription</p>
              </div>
              <Switch checked={isBillableSeat} onCheckedChange={setIsBillableSeat} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-status">Billing status</Label>
              <Select value={billingStatus} onValueChange={(v) => setBillingStatus(v as BillingStatus)}>
                <SelectTrigger id="billing-status" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="EXEMPT">Exempt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Account settings */}
          <div className="space-y-2">
            <Label>Account settings</Label>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch id="edit-mcp" checked={mustChangePassword} onCheckedChange={setMustChangePassword} />
              <Label htmlFor="edit-mcp" className="font-normal text-sm cursor-pointer">Require password change on next login</Label>
            </div>
          </div>

          <PracticeAreaSelector
            selected={practiceAreas}
            specialtyLevel={specialtyLevel}
            onChange={setPracticeAreas}
            onSpecialtyChange={(slug, level) => setSpecialtyLevel((prev) => ({ ...prev, [slug]: level }))}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{tCommon("cancel")}</Button>
          <Button onClick={handleSave} disabled={!name.trim() || submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("saving")}</> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
