"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default function NewMatterPage() {
  const router = useRouter()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/matters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Matter</h1>
          <p className="text-muted-foreground">Create a new legal matter</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matter Intake Wizard</CardTitle>
          <CardDescription>
            This is a simplified version. The full wizard would include:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Step 1: Select client (with search)</li>
            <li>Step 2: Choose matter type (Conveyancing, Litigation, Corporate, etc.)</li>
            <li>Step 3: Add parties and their roles</li>
            <li>Step 4: Set key dates (hearing, filing, limitation)</li>
            <li>Step 5: Review playbook preview (auto-suggested tasks, docs, KYC requirements)</li>
            <li>Conflict check UI with potential conflicts panel</li>
          </ul>
          <div className="pt-4">
            <Button onClick={() => router.push("/app/matters")}>
              Back to Matters
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

