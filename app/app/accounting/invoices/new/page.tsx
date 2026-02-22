"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import { createInvoice } from "@/lib/mock/finance"
import { mockMatters } from "@/lib/mock/matters"
import { mockUsers } from "@/lib/mock/users"
import { useRole } from "@/lib/contexts/role-context"
import { formatNumberWithCommas, parseCommaNumber } from "@/lib/utils"

export default function NewInvoicePage() {
  const router = useRouter()
  const { currentUser } = useRole()
  const user = currentUser || mockUsers[0]

  const [matterId, setMatterId] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [status, setStatus] = useState<"Draft" | "Sent">("Draft")

  const selectedMatter = matterId ? mockMatters.find((m) => m.id === matterId) : undefined

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!matterId || !amount || !dueDate) return

    if (!selectedMatter) return

    createInvoice({
      matterId: selectedMatter.id,
      matterTitle: selectedMatter.title,
      clientId: selectedMatter.clientId,
      clientName: selectedMatter.clientName,
      amount: parseCommaNumber(amount) * 100, // Convert to cents
      status,
      dueDate: new Date(dueDate),
      originatorId: user.id,
      originatorName: user.name,
    })

    router.push("/app/accounting/invoices")
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/accounting/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Invoice</h1>
          <p className="text-muted-foreground">Create a new invoice for a matter</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>Fill in the invoice information below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matter">Matter *</Label>
              <Select value={matterId} onValueChange={setMatterId} required>
                <SelectTrigger id="matter">
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  {mockMatters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.title} - {matter.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMatter && (
                <p className="text-sm text-muted-foreground">
                  Client: {selectedMatter.clientName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0.00"
                  value={formatNumberWithCommas(amount)}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^\d,.]/g, "")
                    const parts = cleaned.split(".")
                    if (parts.length > 2) {
                      setAmount(parts[0] + "." + parts.slice(1).join(""))
                    } else {
                      setAmount(cleaned)
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/app/accounting/invoices">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={!matterId || !amount || !dueDate}>
                <Save className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}




