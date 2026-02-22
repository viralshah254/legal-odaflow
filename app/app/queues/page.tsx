"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function QueuesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Work Queues</h1>
        <p className="text-muted-foreground">Work that needs your attention</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Intake Queue</CardTitle>
            <CardDescription>New matters awaiting intake</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Intake queue items would be displayed here
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KYC Queue</CardTitle>
            <CardDescription>Clients with missing or expired KYC</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            KYC queue items would be displayed here
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Queue</CardTitle>
            <CardDescription>Invoices requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Billing queue items would be displayed here
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trust Approval Queue</CardTitle>
            <CardDescription>Pending trust disbursement approvals</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Trust approvals would be displayed here
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue Critical Deadlines</CardTitle>
            <CardDescription>Critical tasks and deadlines that are overdue</CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Overdue critical items would be displayed here
          </CardContent>
        </Card>
      </div>
    </div>
  )
}




