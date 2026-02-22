"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Building2, Users, Shield, FileText, Bell, CreditCard, UserPlus, Sparkles } from "lucide-react"
import { FirmProfileDialog } from "@/components/settings/firm-profile-dialog"
import { AddUsersDialog } from "@/components/settings/add-users-dialog"
import { useRouter } from "next/navigation"
import { getFirmSettings } from "@/lib/mock/firm-settings"
import { mockUsers } from "@/lib/mock/users"
import { getCurrentSubscription } from "@/lib/mock/subscription"
import { format } from "date-fns"

export default function SettingsPage() {
  const router = useRouter()
  const [firmProfileOpen, setFirmProfileOpen] = useState(false)
  const [addUsersOpen, setAddUsersOpen] = useState(false)
  const [firmSettings, setFirmSettings] = useState(getFirmSettings())
  const [refreshKey, setRefreshKey] = useState(0)
  const subscription = getCurrentSubscription()

  useEffect(() => {
    setFirmSettings(getFirmSettings())
  }, [refreshKey])

  const handleFirmProfileSave = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleUsersAdded = () => {
    setRefreshKey((prev) => prev + 1)
  }
  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your firm settings and preferences</p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Firm Profile</CardTitle>
              </div>
              <CardDescription>Update your firm information and branding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Firm Name: {firmSettings.firmName}</p>
                  <p className="text-sm text-muted-foreground">Industry: {firmSettings.industry}</p>
                  <p className="text-sm text-muted-foreground">Location: {firmSettings.location}</p>
                  {firmSettings.description && (
                    <p className="text-sm text-muted-foreground">Description: {firmSettings.description}</p>
                  )}
                </div>
                <Button variant="outline" onClick={() => setFirmProfileOpen(true)}>
                  Edit Firm Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Users & Roles</CardTitle>
              </div>
              <CardDescription>Manage users and their roles within your firm</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total Users: {mockUsers.length}</p>
                  <p className="text-sm text-muted-foreground">Active Users: {mockUsers.length}</p>
                </div>
                <Button variant="outline" onClick={() => router.push("/app/settings/users")}>
                  Manage Users
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Roles & Permissions</CardTitle>
              </div>
              <CardDescription>Configure role permissions matrix and access controls</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/settings/permissions")}>
                Configure Permissions
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Copilot</CardTitle>
              </div>
              <CardDescription>View Copilot action audit log and compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/app/copilot/audit")}>
                View Audit Log
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Templates</CardTitle>
              </div>
              <CardDescription>Matter types, workflows, task templates, and document folders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Matter Types: 5 configured</p>
                <p className="text-sm text-muted-foreground">Task Templates: 12 available</p>
              </div>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/app/settings/templates")}>
                Manage Templates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Configure notification preferences and channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">Email Notifications</span>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/settings/notifications?type=email")}>
                      Configure
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">SMS Notifications</span>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/settings/notifications?type=sms")}>
                      Configure
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">In-App Notifications</span>
                    <Button variant="outline" size="sm" onClick={() => router.push("/app/settings/notifications")}>
                      Configure
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Billing & Subscription</CardTitle>
              </div>
              <CardDescription>Trial status, seats, and upgrade options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subscription ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
                        <div>
                          <p className="text-sm font-medium">Subscription Status</p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.status === "trial" && subscription.trialEndDate
                              ? `${Math.ceil((subscription.trialEndDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))} days remaining`
                              : "Active"}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                          {subscription.status === "trial" ? "Trial" : "Active"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Current Plan</p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.plan} • {subscription.billingCycle === "monthly" ? "Monthly" : "Annual"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Users</p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.userCount} user{subscription.userCount !== 1 ? "s" : ""} • {subscription.currencySymbol}
                            {subscription.pricePerUser} per user
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setAddUsersOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Users
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Next Billing Date</p>
                          <p className="text-xs text-muted-foreground">
                            {format(subscription.nextBillingDate, "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">Monthly Cost</p>
                          <p className="text-lg font-bold">
                            {subscription.currencySymbol}
                            {subscription.billingCycle === "monthly"
                              ? (subscription.pricePerUser * subscription.userCount).toFixed(2)
                              : ((subscription.pricePerUser * subscription.userCount * 12 * 0.8) / 12).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => router.push("/app/settings/billing")}>
                      Manage Billing
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">No Active Subscription</p>
                          <p className="text-xs text-muted-foreground">Start a free trial to get started</p>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => router.push("/pricing")}>
                      Start Free Trial
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
    </RoleGate>
  )
}

