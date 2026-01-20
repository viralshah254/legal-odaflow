"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SuperAdminPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Super Admin</h1>
        <p className="text-muted-foreground">OdaFlow internal administration</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Manage all firms</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View Tenants</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Billing overview</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View Billing</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>System audit logs</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View Logs</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

