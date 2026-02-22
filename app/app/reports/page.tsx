"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlanGate } from "@/components/plan/plan-gate"

export default function ReportsPage() {
  return (
    <PlanGate
      requiredPlan="PROFESSIONAL"
      feature="Advanced Reports"
      description="Access detailed reports and analytics with the Professional plan"
    >
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View and export reports</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Overdue Tasks by Owner</CardTitle>
              <CardDescription>Tasks overdue grouped by assignee</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Export</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matter Pipeline</CardTitle>
              <CardDescription>Matters by stage and status</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Export</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Aging</CardTitle>
              <CardDescription>Outstanding invoices by age</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Export</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trust Balances</CardTitle>
              <CardDescription>Trust account balances summary</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Export</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PlanGate>
  )
}

