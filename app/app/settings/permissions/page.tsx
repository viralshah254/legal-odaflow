"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Shield, Save } from "lucide-react"
import { ROLE_PERMISSIONS, UserRole } from "@/lib/types/roles"
import { RoleGate } from "@/components/dashboard/role-gate"

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

type FlatPermissionKey = "canViewAllMatters" | "canViewTeam" | "canViewFinance" | "canCreateMatter" | "canAssignTasks" | "canViewAllTasks" | "canViewAllCalendar" | "canManageSettings" | "canApproveTrust"

const permissionLabels: Record<FlatPermissionKey, string> = {
  canViewAllMatters: "View All Matters",
  canViewTeam: "View Team",
  canViewFinance: "View Finance",
  canCreateMatter: "Create Matter",
  canAssignTasks: "Assign Tasks",
  canViewAllTasks: "View All Tasks",
  canViewAllCalendar: "View All Calendar",
  canManageSettings: "Manage Settings",
  canApproveTrust: "Approve Trust",
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState(ROLE_PERMISSIONS)

  const handlePermissionChange = (role: UserRole, permission: FlatPermissionKey, value: boolean) => {
    setPermissions({
      ...permissions,
      [role]: {
        ...permissions[role],
        [permission]: value,
      },
    })
  }

  const handleSave = () => {
    // In a real app, this would save to the backend
    alert("Permissions saved successfully!")
  }

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
            <h1 className="text-3xl font-bold">Roles & Permissions</h1>
            <p className="text-muted-foreground">Configure role permissions matrix and access controls</p>
          </div>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>

        <div className="space-y-6">
          {Object.entries(permissions).map(([role, rolePerms]) => (
            <Card key={role}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>{roleDisplayNames[role as UserRole]}</CardTitle>
                </div>
                <CardDescription>Configure permissions for {roleDisplayNames[role as UserRole]} role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(Object.entries(rolePerms).filter(([k]) => k in permissionLabels) as [FlatPermissionKey, boolean][]).map(([permKey, value]) => (
                    <div key={permKey} className="flex items-center space-x-2 p-3 rounded-lg border">
                      <Checkbox
                        id={`${role}-${permKey}`}
                        checked={value}
                        onCheckedChange={(checked) =>
                          handlePermissionChange(role as UserRole, permKey, checked as boolean)
                        }
                        disabled={role === "PARTNER_ADMIN"}
                      />
                      <Label
                        htmlFor={`${role}-${permKey}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {permissionLabels[permKey]}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </RoleGate>
  )
}




