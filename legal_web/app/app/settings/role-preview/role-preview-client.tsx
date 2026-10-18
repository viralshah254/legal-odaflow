"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRole } from "@/lib/contexts/role-context"
import { persistDevRole } from "@/lib/dev/dev-role-switcher"
import { ROLE_PERMISSIONS, type UserRole } from "@/lib/types/roles"

const roles: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "PARALEGAL",
  "FINANCE",
  "INTAKE",
  "OPS_HR",
  "RECEPTION",
  "READ_ONLY",
]

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

export function RolePreviewClient() {
  const t = useTranslations("settings")
  const tAdmin = useTranslations("admin")
  const { currentRole, currentUser, setCurrentRole, setCurrentUser } = useRole()
  const router = useRouter()

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role)
    persistDevRole(role)

    const base = currentUser ?? { id: "dev-user", name: "User", email: "" }
    setCurrentUser({ ...base, role })

    router.push("/app/dashboard")
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="h-6 w-6 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold">{t("role_preview_dev_only")}</h1>
          <p className="text-sm text-muted-foreground">
            Switch between roles to preview different dashboard views. This page is only available in development.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("current_role")}</CardTitle>
          <CardDescription>{t("you_are_currently_viewing_as")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {roleDisplayNames[currentRole]}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("switch_role")}</CardTitle>
          <CardDescription>{t("select_a_role_to_preview_its_dashboard")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((role) => (
              <Button
                key={role}
                variant={currentRole === role ? "default" : "outline"}
                className="h-auto py-4 flex flex-col items-start"
                onClick={() => handleRoleChange(role)}
              >
                <span className="font-semibold">{roleDisplayNames[role]}</span>
                <span className="text-xs text-muted-foreground mt-1">{role}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("role_permissions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("view_all_matters")}</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("view_team")}</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "OPS_HR" || currentRole === "READ_ONLY" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "OPS_HR" || currentRole === "READ_ONLY" ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("view_finance")}</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{t("create_matter")}</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "ASSOCIATE" || currentRole === "INTAKE" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "ASSOCIATE" || currentRole === "INTAKE" ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("copilot_capabilities")}</CardTitle>
          <CardDescription>{t("this_role_can_use_the_following_copilot_features")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ROLE_PERMISSIONS[currentRole].copilotPermissions.length === 0 ? (
              <span className="text-sm text-muted-foreground">{tAdmin("none")}</span>
            ) : (
              ROLE_PERMISSIONS[currentRole].copilotPermissions.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">
                  {p.replace("canUse", "").replace("canApprove", "Approve ").replace(/([A-Z])/g, " $1").trim()}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
