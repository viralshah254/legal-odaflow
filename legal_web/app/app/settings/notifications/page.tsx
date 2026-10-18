"use client"
import { useTranslations } from "next-intl"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Mail, MessageSquare, Bell, Save, Loader2 } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { getMyPreferences, updateMyPreferences } from "@/lib/api/profile"

interface NotificationSettings {
  email: {
    taskDue: boolean
    taskOverdue: boolean
    kycExpired: boolean
    invoiceOverdue: boolean
    trustApproval: boolean
    mention: boolean
  }
  sms: {
    taskDue: boolean
    taskOverdue: boolean
    kycExpired: boolean
    invoiceOverdue: boolean
  }
  inApp: {
    taskDue: boolean
    taskOverdue: boolean
    kycExpired: boolean
    invoiceOverdue: boolean
    trustApproval: boolean
    mention: boolean
    assistanceRequest: boolean
    caseTransferred: boolean
  }
}

const defaultSettings: NotificationSettings = {
  email: {
    taskDue: true,
    taskOverdue: true,
    kycExpired: true,
    invoiceOverdue: true,
    trustApproval: true,
    mention: true,
  },
  sms: {
    taskDue: false,
    taskOverdue: true,
    kycExpired: false,
    invoiceOverdue: true,
  },
  inApp: {
    taskDue: true,
    taskOverdue: true,
    kycExpired: true,
    invoiceOverdue: true,
    trustApproval: true,
    mention: true,
    assistanceRequest: true,
    caseTransferred: true,
  },
}

function NotificationsContent() {
  const t = useTranslations("settings")
  const searchParams = useSearchParams()
  const type = searchParams.get("type")
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getMyPreferences()
      .then((prefs) => {
        setSettings({
          ...defaultSettings,
          email: {
            ...defaultSettings.email,
            taskDue: prefs.taskReminders,
            taskOverdue: prefs.taskReminders,
            kycExpired: prefs.emailNotifications,
            invoiceOverdue: prefs.billingAlerts,
            trustApproval: prefs.trustApprovalAlerts,
            mention: prefs.emailNotifications,
          },
          inApp: {
            ...defaultSettings.inApp,
            taskDue: prefs.taskReminders,
            taskOverdue: prefs.taskReminders,
            kycExpired: prefs.pushNotifications,
            invoiceOverdue: prefs.billingAlerts,
            trustApproval: prefs.trustApprovalAlerts,
            mention: prefs.pushNotifications,
            assistanceRequest: prefs.pushNotifications,
            caseTransferred: prefs.pushNotifications,
          },
        })
      })
      .catch(() => {
        const saved = localStorage.getItem("notification-settings")
        if (saved) {
          try {
            setSettings({ ...defaultSettings, ...JSON.parse(saved) })
          } catch {
            /* use defaults */
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSettingChange = (category: keyof NotificationSettings, key: string, value: boolean) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMyPreferences({
        emailNotifications: settings.email.kycExpired || settings.email.mention,
        pushNotifications: settings.inApp.mention,
        taskReminders: settings.email.taskDue,
        billingAlerts: settings.email.invoiceOverdue,
        trustApprovalAlerts: settings.email.trustApproval,
      })
      localStorage.setItem("notification-settings", JSON.stringify(settings))
      alert("Notification settings saved successfully!")
    } catch {
      localStorage.setItem("notification-settings", JSON.stringify(settings))
      alert("Saved locally (sign in required for server sync).")
    } finally {
      setSaving(false)
    }
  }

  const notificationLabels: Record<string, string> = {
    taskDue: "Task Due",
    taskOverdue: "Task Overdue",
    kycExpired: "KYC Expired",
    invoiceOverdue: "Invoice Overdue",
    trustApproval: "Trust Approval Required",
    mention: "Mentioned in Comment",
    assistanceRequest: "Assistance Request",
    caseTransferred: "Case Transferred",
  }

  const defaultTab = type === "email" ? "email" : type === "sms" ? "sms" : "in-app"

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{t("notification_settings")}</h1>
            <p className="text-muted-foreground">{t("configure_notification_preferences_and_channels")}</p>
          </div>
          <Button onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              {t("email_notifications")}
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="h-4 w-4 mr-2" />
              {t("sms_notifications")}
            </TabsTrigger>
            <TabsTrigger value="in-app">
              <Bell className="h-4 w-4 mr-2" />
              {t("in-app_notifications")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("email_notifications")}</CardTitle>
                <CardDescription>{t("configure_which_events_trigger_email_notifications")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.email).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 rounded-lg border">
                    <Label htmlFor={`email-${key}`} className="cursor-pointer flex-1">
                      {notificationLabels[key] || key}
                    </Label>
                    <Switch
                      id={`email-${key}`}
                      checked={value}
                      onCheckedChange={(checked) => handleSettingChange("email", key, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("sms_notifications")}</CardTitle>
                <CardDescription>{t("configure_which_events_trigger_sms_notifications")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.sms).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 rounded-lg border">
                    <Label htmlFor={`sms-${key}`} className="cursor-pointer flex-1">
                      {notificationLabels[key] || key}
                    </Label>
                    <Switch
                      id={`sms-${key}`}
                      checked={value}
                      onCheckedChange={(checked) => handleSettingChange("sms", key, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="in-app" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("in-app_notifications")}</CardTitle>
                <CardDescription>{t("configure_which_events_trigger_in-app_notifications")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.inApp).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 rounded-lg border">
                    <Label htmlFor={`inapp-${key}`} className="cursor-pointer flex-1">
                      {notificationLabels[key] || key}
                    </Label>
                    <Switch
                      id={`inapp-${key}`}
                      checked={value}
                      onCheckedChange={(checked) => handleSettingChange("inApp", key, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGate>
  )
}

export default function NotificationsPage() {
  const tAuth = useTranslations("auth")
  return (
    <Suspense fallback={<div className="p-6">{tAuth("loading")}</div>}>
      <NotificationsContent />
    </Suspense>
  )
}

