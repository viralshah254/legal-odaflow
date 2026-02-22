"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Mail, MessageSquare, Bell, Save } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"

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
  const searchParams = useSearchParams()
  const type = searchParams.get("type")
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings)

  useEffect(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem("notification-settings")
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) })
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }
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

  const handleSave = () => {
    localStorage.setItem("notification-settings", JSON.stringify(settings))
    alert("Notification settings saved successfully!")
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
            <h1 className="text-3xl font-bold">Notification Settings</h1>
            <p className="text-muted-foreground">Configure notification preferences and channels</p>
          </div>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="in-app">
              <Bell className="h-4 w-4 mr-2" />
              In-App
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure which events trigger email notifications</CardDescription>
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
                <CardTitle>SMS Notifications</CardTitle>
                <CardDescription>Configure which events trigger SMS notifications</CardDescription>
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
                <CardTitle>In-App Notifications</CardTitle>
                <CardDescription>Configure which events trigger in-app notifications</CardDescription>
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
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <NotificationsContent />
    </Suspense>
  )
}

