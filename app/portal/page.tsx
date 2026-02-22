"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Client Portal</h1>
          <p className="text-muted-foreground">Welcome to your client portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document Requests</CardTitle>
            <CardDescription>Documents requested by your legal team</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Document upload requests would be displayed here
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matter Progress</CardTitle>
            <CardDescription>View progress on your matters</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Matter progress would be displayed here
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>View and pay invoices</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Invoices would be displayed here
          </CardContent>
        </Card>
      </div>
    </div>
  )
}




