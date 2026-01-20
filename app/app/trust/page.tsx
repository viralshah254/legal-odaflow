"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"

export default function TrustPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trust Accounts</h1>
          <p className="text-muted-foreground">Manage trust accounts and transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Deposit
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Disbursement
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trust Balances</CardTitle>
          <CardDescription>Trust account balances by client/matter</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground">
          Trust balances table and transactions list would be displayed here
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Disbursement approvals queue</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-muted-foreground">
          Pending trust disbursement approvals would be displayed here
        </CardContent>
      </Card>
    </div>
  )
}

