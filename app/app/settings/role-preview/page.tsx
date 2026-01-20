"use client"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { UserRole } from "@/lib/types/roles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockUsers } from "@/lib/mock/users"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

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

export default function RolePreviewPage() {
  const { currentRole, setCurrentRole, setCurrentUser } = useRole()
  const router = useRouter()

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role)
    localStorage.setItem("dev-current-role", role)
    
    // Set a mock user for this role
    const user = mockUsers.find((u) => u.role === role) || mockUsers[0]
    setCurrentUser({ ...user, role })
    
    // Redirect to dashboard
    router.push("/app/dashboard")
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="h-6 w-6 text-orange-600" />
        <div>
          <h1 className="text-2xl font-bold">Role Preview (Dev Only)</h1>
          <p className="text-sm text-muted-foreground">
            Switch between roles to preview different dashboard views. This page is only available in development.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Role</CardTitle>
          <CardDescription>You are currently viewing as:</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {roleDisplayNames[currentRole]}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Switch Role</CardTitle>
          <CardDescription>Select a role to preview its dashboard:</CardDescription>
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
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">View All Matters:</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">View Team:</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "OPS_HR" || currentRole === "READ_ONLY" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "OPS_HR" || currentRole === "READ_ONLY" ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">View Finance:</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "FINANCE" || currentRole === "READ_ONLY" ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Create Matter:</span>
              <Badge variant={currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "ASSOCIATE" || currentRole === "INTAKE" ? "default" : "outline"}>
                {currentRole === "PARTNER_ADMIN" || currentRole === "JUNIOR_PARTNER" || currentRole === "ASSOCIATE" || currentRole === "INTAKE" ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

