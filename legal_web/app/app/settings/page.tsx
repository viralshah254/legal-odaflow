"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Building2, Users, Shield, FileText, Bell, CreditCard, UserPlus, Sparkles, Loader2, Scale, Database, KeyRound, Crown } from "lucide-react"
import { FirmProfileDialog } from "@/components/settings/firm-profile-dialog"
import { AddUsersDialog } from "@/components/settings/add-users-dialog"
import { DraftingStyleSetupDialog } from "@/components/settings/drafting-style-dialog"
import { getUserDraftStyle, STYLE_ANALYSIS_CREDITS, type UserDraftStyleState } from "@/lib/api/user-draft-style"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listTenantUsers } from "@/lib/api/users"
import { getFirmProfile } from "@/lib/api/governance"
import { billingPlanToTier } from "@/lib/utils/plan-from-tenant"
import { useBillingDisplay } from "@/lib/hooks/use-billing-display"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { LanguageSettingsCard } from "@/components/settings/language-settings-card"
import { useTranslations } from "next-intl"
import { ThemeSelectorGrid } from "@/components/ui/theme-selector"
import { ThemeToggle } from "@/components/theme-toggle"
import { Palette } from "lucide-react"

export default function SettingsPage() {
  const toFixed = useTranslations("settings")
  const tConsumer = useTranslations("consumer")
  const tCopilot = useTranslations("copilot")
  const tMarketing = useTranslations("marketing")
  const tDashboard = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const t = useTranslations("settings")
  const { getTierDisplayLabel } = usePlanPricingI18n()
  const router = useRouter()
  const { activeTenant, activeTenantId, isLoading: tenantLoading } = useTenant()
  const { pricePerUser, formatAmount } = useBillingDisplay()
  const [firmProfileOpen, setFirmProfileOpen] = useState(false)
  const [addUsersOpen, setAddUsersOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [draftStyleOpen, setDraftStyleOpen] = useState(false)
  const [draftStyle, setDraftStyle] = useState<UserDraftStyleState | null>(null)

  useEffect(() => {
    getUserDraftStyle().then(setDraftStyle).catch(() => {})
  }, [])

  const tenant = activeTenant?.tenant
  const plan = billingPlanToTier(tenant?.billingPlan)

  const { data: firmProfileData } = useApiData(
    ["firm-profile", activeTenantId, refreshKey],
    {
      apiFn: () => getFirmProfile(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: tenantUsers = [], isLoading: usersLoading } = useApiData(
    ["tenant-users", activeTenantId, refreshKey],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const userCount = tenantUsers.length

  const handleFirmProfileSave = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleUsersAdded = () => {
    setRefreshKey((prev) => prev + 1)
  }

  if (tenantLoading) {
    return (
      <div className="p-6">
        <PageSkeleton rows={6} />
      </div>
    )
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]} requiredPermission="canManageSettings">
      <div className="p-6 space-y-6" data-tour="settings-hub">
        <PageHeader
          title={t("title")}
          description={t("settingsDescription")}
          actions={<OpenCopilotButton />}
        />

        <LanguageSettingsCard />

        {/* Appearance / theme */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Appearance</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Dark mode</span>
                <ThemeToggle />
              </div>
            </div>
            <CardDescription>Choose a colour theme for your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSelectorGrid />
          </CardContent>
        </Card>

        {/* My Drafting Style */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <CardTitle>My Drafting Style</CardTitle>
              </div>
              {draftStyle?.status === "ready" && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <CardDescription>
              Train the AI on your personal drafting voice. Upload your past drafts and every document
              you generate will match your style.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {draftStyle?.status === "ready" ? (
                <>
                  {draftStyle.styleProfile && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {draftStyle.styleProfile}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                    <span>{draftStyle.documentCount} sample{draftStyle.documentCount !== 1 ? "s" : ""} · Version {draftStyle.styleVersion}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDraftStyleOpen(true)}>
                      Update samples
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDraftStyleOpen(true)}>
                      View profile
                    </Button>
                  </div>
                </>
              ) : draftStyle?.status === "processing" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing your drafting style…
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Not set up yet. Upload 3–4 of your past drafts to get started.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setDraftStyleOpen(true)}>
                      Set up my style
                    </Button>
                    <span className="text-xs text-muted-foreground">{STYLE_ANALYSIS_CREDITS} credits · one-time</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("firm_profile")}</CardTitle>
              </div>
              <CardDescription>{t("update_your_firm_information_and_branding")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  {/* Logo preview */}
                  {firmProfileData?.logoUrl ? (
                    <div className="h-12 w-24 rounded border border-border flex items-center justify-center bg-muted/20 shrink-0 overflow-hidden">
                      <Image
                        src={firmProfileData.logoUrl}
                        alt="Firm logo"
                        width={88}
                        height={40}
                        className="max-h-10 w-auto max-w-[88px] object-contain"
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("firm_name_label")}: {tenant?.name ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">{t("industry_legal_services")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("location_label")}: {tenant?.primaryCountry ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("logo_on_exports")}:{" "}
                      <span className={firmProfileData?.documentBranding?.showLogoOnExports ? "text-green-600 dark:text-green-400" : ""}>
                        {firmProfileData?.documentBranding?.showLogoOnExports
                          ? t("logo_on_exports_enabled")
                          : t("logo_on_exports_disabled")}
                      </span>
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setFirmProfileOpen(true)}>
                  {t("edit_firm_profile")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("users_roles")}</CardTitle>
              </div>
              <CardDescription>{t("manage_users_and_their_roles_within_your_firm")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("total_users")}: {usersLoading ? "…" : userCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("active_users")}: {usersLoading ? "…" : tenantUsers.filter((u) => u.user.isActive).length}
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/app/settings/users")}>
                  {t("manage_users")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("roles_permissions")}</CardTitle>
              </div>
              <CardDescription>{t("configure_role_permissions_matrix_and_access_controls")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/settings/permissions")}>
                {t("configure_permissions")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{tConsumer("ai_credits")}</CardTitle>
              </div>
              <CardDescription>{t("balance_usage_ledger_and_credit_packs")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/app/settings/plan-usage")}>
                {t("plan_usage")}
              </Button>
              <Button variant="ghost" onClick={() => router.push("/app/settings/credits")}>
                {t("credit_ledger")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Payment methods</CardTitle>
              </div>
              <CardDescription>
                Manage the card used for automatic credit top-ups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/settings/payment-methods")}>
                Manage payment methods
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{tCopilot("title")}</CardTitle>
              </div>
              <CardDescription>{t("view_copilot_action_audit_log_and_compliance")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/copilot/audit/")}>
                {t("view_audit_log")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{tMarketing("data_ai_consent")}</CardTitle>
              </div>
              <CardDescription>{t("training_opt-in_governance_and_compliance_defaults")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/app/settings/data-consent")}>
                {t("data_consent")}
              </Button>
              <Button variant="outline" onClick={() => router.push("/app/settings/privacy")}>
                {t("privacy_security")}
              </Button>
              <Button variant="outline" onClick={() => router.push("/app/settings/governance")}>
                {t("governance")}
              </Button>
              <Button variant="outline" onClick={() => router.push("/app/settings/ai-policy")}>
                {t("ai_policy")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{tDashboard("compliance")}</CardTitle>
              </div>
              <CardDescription>{t("firm_compliance_settings_and_audit_visibility")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/settings/compliance")}>
                {t("open_compliance_settings")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("templates_playbooks")}</CardTitle>
              </div>
              <CardDescription>{t("matter_playbooks_workflows_and_document_templates")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push("/app/templates")}>
                {t("document_templates")}
              </Button>
              <Button variant="outline" onClick={() => router.push("/app/settings/playbooks")}>
                {t("matter_playbooks")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("integrations")}</CardTitle>
              </div>
              <CardDescription>{t("calendar_email_meetings_e-sign_and_accounting")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/settings/integrations")}>
                {t("manage_integrations")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{tCommon("notifications")}</CardTitle>
              </div>
              <CardDescription>{t("configure_notification_preferences_and_channels")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{t("email_notifications")}</span>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/settings/notifications?type=email")}>
                      {t("configure")}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{t("sms_notifications")}</span>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/settings/notifications?type=sms")}>
                      {t("configure")}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{t("in-app_notifications")}</span>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/settings/notifications")}>
                      {t("configure")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("enterprise_sso")}</CardTitle>
              </div>
              <CardDescription>{t("saml_sso_data_region_and_residency_controls")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => router.push("/app/settings/sso")}>
                {t("configure_sso")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Trust Center</CardTitle>
              </div>
              <CardDescription>SOC 2 controls, ethical AI commitments, and compliance certifications.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => router.push("/trust")}>
                View Trust Center
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("data_migration")}</CardTitle>
              <CardDescription>{t("import_clients_and_matters_from_clio_csv")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => router.push("/app/settings/migration")}>
                {t("clio_import")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("billing_subscription")}</CardTitle>
              </div>
              <CardDescription>{t("trial_status_seats_and_upgrade_options")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {plan ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
                        <div>
                          <p className="text-sm font-medium">{t("subscription_status")}</p>
                          <p className="text-xs text-muted-foreground">{tConsumer("active")}</p>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                          {tConsumer("active")}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{tCommon("current_plan")}</p>
                          <p className="text-xs text-muted-foreground">{getTierDisplayLabel(plan)} · Monthly</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{tAdmin("users")}</p>
                          <p className="text-xs text-muted-foreground">
                            {userCount} user{userCount !== 1 ? "s" : ""} • {formatAmount(pricePerUser)} per user
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setAddUsersOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          {t("add_users")}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{t("monthly_cost")}</p>
                          <p className="text-lg font-bold">
                            {formatAmount(pricePerUser * userCount)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => router.push("/app/settings/billing")}>
                      {t("manage_billing")}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{t("no_active_subscription")}</p>
                          <p className="text-xs text-muted-foreground">{t("start_a_free_trial_to_get_started")}</p>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => router.push("/pricing")}>
                      {t("start_free_trial")}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <FirmProfileDialog open={firmProfileOpen} onOpenChange={setFirmProfileOpen} onSave={handleFirmProfileSave} />
      <AddUsersDialog open={addUsersOpen} onOpenChange={setAddUsersOpen} onUsersAdded={handleUsersAdded} />
      <DraftingStyleSetupDialog
        open={draftStyleOpen}
        onOpenChange={setDraftStyleOpen}
        onStyleReady={() => {
          getUserDraftStyle().then(setDraftStyle).catch(() => {})
        }}
      />
    </RoleGate>
  )
}
