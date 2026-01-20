"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function StatementsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Statements</h1>
        <p className="text-muted-foreground">Generate client statements</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Statement Generator</CardTitle>
          <CardDescription>Select date range and generate statements</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">
            Statement generator UI with date range selector and download functionality
          </p>
          <Button>Generate Statement</Button>
        </CardContent>
      </Card>
    </div>
  )
}

