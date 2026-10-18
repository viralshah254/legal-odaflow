"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Shield, Save, Loader2 } from "lucide-react"
import { ROLE_PERMISSIONS, UserRole } from "@/lib/types/roles"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { mergeTenantRolePermissions } from "@/lib/auth/role-permissions"
import {
  getRolePermissions,
  updateRolePermissions,
  type FlatRolePermissionKey,
  type TenantRolePermissionsMap,
} from "@/lib/api/governance"

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

const permissionLabels: Record<FlatRolePermissionKey, string> = {
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

function mergeWithDefaults(remote: TenantRolePermissionsMap): typeof ROLE_PERMISSIONS {
  return mergeTenantRolePermissions(remote)
}

export default function PermissionsPage() {
  const t = useTranslations("settings")
  const { activeTenantId } = useTenant()
  const { refreshRolePermissions } = useRole()
  const [permissions, setPermissions] = useState(ROLE_PERMISSIONS)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["role-permissions", activeTenantId],
    queryFn: () => getRolePermissions(activeTenantId!),
    enabled: !!activeTenantId,
  })

  useEffect(() => {
    if (data) {
      setPermissions(mergeWithDefaults(data))
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeTenantId) throw new Error("No tenant")
      const payload: TenantRolePermissionsMap = {}
      for (const role of Object.keys(permissions) as UserRole[]) {
        if (role === "PARTNER_ADMIN") continue
        payload[role] = {
          canViewAllMatters: permissions[role].canViewAllMatters,
          canViewTeam: permissions[role].canViewTeam,
          canViewFinance: permissions[role].canViewFinance,
          canCreateMatter: permissions[role].canCreateMatter,
          canAssignTasks: permissions[role].canAssignTasks,
          canViewAllTasks: permissions[role].canViewAllTasks,
          canViewAllCalendar: permissions[role].canViewAllCalendar,
          canManageSettings: permissions[role].canManageSettings,
          canApproveTrust: permissions[role].canApproveTrust,
        }
      }
      return updateRolePermissions(activeTenantId, payload)
    },
    onSuccess: async () => {
      setSaveMessage("Permissions saved.")
      await refreshRolePermissions()
      setTimeout(() => setSaveMessage(null), 4000)
    },
    onError: () => {
      setSaveMessage("Failed to save permissions. Try again.")
    },
  })

  const handlePermissionChange = (role: UserRole, permission: FlatRolePermissionKey, value: boolean) => {
    setPermissions({
      ...permissions,
      [role]: {
        ...permissions[role],
        [permission]: value,
      },
    })
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]} requiredPermission="canManageSettings">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{t("roles_permissions")}</h1>
            <p className="text-muted-foreground">
              Configure role permissions — saved to your firm profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className="text-sm text-muted-foreground">{saveMessage}</span>
            )}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!activeTenantId || saveMutation.isPending || isLoading}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">{t("loading_permissions")}</p>
        ) : (
          <div className="space-y-6">
            {(Object.entries(permissions) as [UserRole, (typeof permissions)[UserRole]][]).map(
              ([role, rolePerms]) => (
                <Card key={role}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>{roleDisplayNames[role]}</CardTitle>
                    </div>
                    <CardDescription>
                      Configure permissions for {roleDisplayNames[role]}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(Object.keys(permissionLabels) as FlatRolePermissionKey[]).map(
                        (permKey) => (
                          <div
                            key={permKey}
                            className="flex items-center space-x-2 p-3 rounded-lg border"
                          >
                            <Checkbox
                              id={`${role}-${permKey}`}
                              checked={rolePerms[permKey]}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(role, permKey, checked === true)
                              }
                              disabled={role === "PARTNER_ADMIN"}
                            />
                            <Label
                              htmlFor={`${role}-${permKey}`}
                              className="text-sm font-medium leading-none cursor-pointer flex-1"
                            >
                              {permissionLabels[permKey]}
                            </Label>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </div>
    </RoleGate>
  )
}
