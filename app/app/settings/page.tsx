"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your firm settings</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Firm Profile</CardTitle>
            <CardDescription>Update your firm information</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Edit Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users & Roles</CardTitle>
            <CardDescription>Manage users and their roles</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Manage Users</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
            <CardDescription>Configure role permissions matrix</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Configure Permissions</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Matter types, workflows, task templates, doc folders</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Manage Templates</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Configure Notifications</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Trial status, seats, upgrade options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">Trial Status: Active (15 days remaining)</p>
              <Button>Upgrade Plan</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

