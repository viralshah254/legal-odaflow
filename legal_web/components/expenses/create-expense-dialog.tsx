"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ExpenseCategory } from "@/lib/types/expenses"
import { listMatters } from "@/lib/api/matters"
import { listClients } from "@/lib/api/clients"
import { createExpense } from "@/lib/api/finance"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatNumberWithCommas, parseCommaNumber } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface CreateExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function CreateExpenseDialog({ open, onOpenChange, onSave }: CreateExpenseDialogProps) {
  const t = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const { currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const user = currentUser ?? { id: "", name: "User", email: "" }

  const { data: matters = [] } = useApiData(
    ["matters-for-expense", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId && open },
  )

  const { data: clients = [] } = useApiData(
    ["clients-for-expense", activeTenantId],
    { apiFn: () => listClients(activeTenantId!), enabled: !!activeTenantId && open },
  )

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Other")
  const [matterId, setMatterId] = useState<string | undefined>(undefined)
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

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

  const handleSave = async () => {
    if (!description || !amount || !activeTenantId) return
    setSubmitting(true)
    try {
      await createExpense(activeTenantId, {
        description,
        amount: parseCommaNumber(amount) * 100,
        category,
        matterId: matterId || null,
        clientId: clientId || null,
        status: "APPROVED",
      })
      setDescription("")
      setAmount("")
      setCategory("Other")
      setMatterId(undefined)
      setClientId(undefined)
      setNotes("")
      onSave()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("create_expense")}</DialogTitle>
          <DialogDescription>{t("record_a_new_expense_for_the_firm")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">{tBilling("description_2")}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("eg_court_filing_fees")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{tBilling("amount_kes")}</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
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
                placeholder={tBilling("000")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{tBilling("category")}</Label>
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
              <Label htmlFor="matter">{t("matter_optional")}</Label>
              <Select
                value={matterId || "none"}
                onValueChange={(value) => setMatterId(value === "none" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tBilling("select_a_matter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tAdmin("none")}</SelectItem>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">{t("client_optional")}</Label>
              <Select
                value={clientId || "none"}
                onValueChange={(value) => setClientId(value === "none" ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select_a_client")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tAdmin("none")}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes_optional")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("additional_notes_about_this_expense")}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!description || !amount || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Expense"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
