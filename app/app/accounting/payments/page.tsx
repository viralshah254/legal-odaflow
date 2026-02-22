"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground">View payment records</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Records</CardTitle>
          <CardDescription>List of payments linked to invoices</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground">
          Payment records would be displayed here
        </CardContent>
      </Card>
    </div>
  )
}




