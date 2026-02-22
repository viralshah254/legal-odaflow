"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ExpenseCategory } from "@/lib/types/expenses"
import { mockMatters } from "@/lib/mock/matters"
import { mockClients } from "@/lib/mock/clients"
import { createExpense } from "@/lib/mock/expenses"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { formatNumberWithCommas, parseCommaNumber } from "@/lib/utils"

interface CreateExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function CreateExpenseDialog({ open, onOpenChange, onSave }: CreateExpenseDialogProps) {
  const { currentRole, currentUser } = useRole()
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Other")
  const [matterId, setMatterId] = useState<string | undefined>(undefined)
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")

  const categories: ExpenseCategory[] = [
    "Office Supplies",
    "Travel",
    "Filing Fees",
    "Court Fees",
    "Professional Services",
    "Technology",
    "Utilities",
    "Rent",
    "Marketing",
    "Other",
  ]

  const handleSave = () => {
    if (!description || !amount) return

    const selectedMatter = matterId ? mockMatters.find((m) => m.id === matterId) : undefined
    const selectedClient = clientId
      ? mockClients.find((c) => c.id === clientId)
      : selectedMatter
      ? mockClients.find((c) => c.id === selectedMatter.clientId)
      : undefined

    createExpense({
      description,
      amount: parseCommaNumber(amount) * 100, // Convert to cents
      category,
      matterId: selectedMatter?.id,
      matterTitle: selectedMatter?.title,
      clientId: selectedClient?.id,
      clientName: selectedClient?.name,
      date: new Date(date),
      createdBy: user.id,
      createdByName: user.name,
      notes: notes || undefined,
    })

    // Reset form
    setDescription("")
    setAmount("")
    setCategory("Other")
    setMatterId(undefined)
    setClientId(undefined)
    setDate(new Date().toISOString().split("T")[0])
    setNotes("")

    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Expense</DialogTitle>
          <DialogDescription>Record a new expense for the firm</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Court filing fees"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(amount)}
                onChange={(e) => {
                  // Allow only numbers, commas, and one decimal point
                  const cleaned = e.target.value.replace(/[^\d,.]/g, "")
                  // Ensure only one decimal point
                  const parts = cleaned.split(".")
                  if (parts.length > 2) {
                    setAmount(parts[0] + "." + parts.slice(1).join(""))
                  } else {
                    setAmount(cleaned)
                  }
                }}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matter">Matter (Optional)</Label>
              <Select value={matterId || "none"} onValueChange={(value) => setMatterId(value === "none" ? undefined : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mockMatters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client (Optional)</Label>
              <Select value={clientId || "none"} onValueChange={(value) => setClientId(value === "none" ? undefined : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mockClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this expense"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!description || !amount}>
            Create Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

