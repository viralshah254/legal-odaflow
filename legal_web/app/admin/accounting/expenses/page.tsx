"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, Pencil, Trash2, Receipt } from "lucide-react"
import {
  getAccountingExpenses,
  createAccountingExpense,
  updateAccountingExpense,
  deleteAccountingExpense,
  type PlatformExpense,
} from "@/lib/api/admin-extended"

const CATEGORIES = [
  { value: "ai_providers", label: "AI Providers" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "payroll", label: "Payroll" },
  { value: "marketing", label: "Marketing" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
]

const CAT_BADGE: Record<string, string> = {
  ai_providers: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  infrastructure: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  payroll: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  marketing: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  legal: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  other: "bg-muted text-muted-foreground",
}

function fmt(n: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

const EMPTY_FORM = {
  category: "other",
  vendor: "",
  description: "",
  amount: "",
  currency: "USD",
  taxAmount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  isRecurring: false,
  receiptUrl: "",
}

type ExpenseForm = typeof EMPTY_FORM

function ExpenseDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: Partial<PlatformExpense> | null
  onClose: () => void
  onSave: (form: ExpenseForm, id?: string) => Promise<void>
}) {
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (initial) {
      setForm({
        category: initial.category ?? "other",
        vendor: initial.vendor ?? "",
        description: initial.description ?? "",
        amount: initial.amount ? String(Number(initial.amount)) : "",
        currency: initial.currency ?? "USD",
        taxAmount: initial.taxAmount ? String(Number(initial.taxAmount)) : "",
        expenseDate: initial.expenseDate
          ? new Date(initial.expenseDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        isRecurring: initial.isRecurring ?? false,
        receiptUrl: initial.receiptUrl ?? "",
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErr("")
  }, [initial, open])

  const field = (k: keyof ExpenseForm, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.expenseDate) {
      setErr("Description, amount and date are required.")
      return
    }
    setSaving(true)
    setErr("")
    try {
      await onSave(form, initial?.id)
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={(v) => field("category", v)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vendor</Label>
            <Input value={form.vendor} onChange={(e) => field("vendor", e.target.value)} placeholder="e.g. OpenAI" className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description *</Label>
            <Input value={form.description} onChange={(e) => field("description", e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount *</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => field("amount", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency} onChange={(e) => field("currency", e.target.value.toUpperCase())} maxLength={3} className="text-sm uppercase" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tax Amount</Label>
              <Input type="number" min="0" step="0.01" value={form.taxAmount} onChange={(e) => field("taxAmount", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.expenseDate} onChange={(e) => field("expenseDate", e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Receipt URL</Label>
            <Input value={form.receiptUrl} onChange={(e) => field("receiptUrl", e.target.value)} placeholder="https://…" className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isRecurring}
              onCheckedChange={(v) => field("isRecurring", v)}
              id="recurring"
            />
            <Label htmlFor="recurring" className="text-sm cursor-pointer">Recurring expense</Label>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {initial?.id ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<PlatformExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<PlatformExpense> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformExpense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [category, setCategory] = useState("all")

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getAccountingExpenses({
      from: from || undefined,
      to: to || undefined,
      category: category !== "all" ? category : undefined,
    })
      .then(setExpenses)
      .catch((e) => setError(e.message ?? "Failed"))
      .finally(() => setLoading(false))
  }, [from, to, category])

  useEffect(() => { load() }, [load])

  const handleSave = async (form: ExpenseForm, id?: string) => {
    const payload = {
      category: form.category,
      vendor: form.vendor || undefined,
      description: form.description,
      amount: Number(form.amount),
      currency: form.currency,
      taxAmount: form.taxAmount ? Number(form.taxAmount) : undefined,
      expenseDate: form.expenseDate,
      isRecurring: form.isRecurring,
      receiptUrl: form.receiptUrl || undefined,
    }
    if (id) {
      await updateAccountingExpense(id, payload)
    } else {
      await createAccountingExpense(payload)
    }
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAccountingExpense(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Expenses</h1>
            <p className="text-sm text-muted-foreground">
              {expenses.length} entries &middot; {fmt(totalAmount)} total
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add expense
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 text-sm" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 text-sm" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44 text-sm"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); setCategory("all") }}>
          Reset
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Date</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Category</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Vendor</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Description</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">Tax</th>
                    <th className="py-3 px-4 text-center font-medium text-muted-foreground">Recurring</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        No expenses yet
                      </td>
                    </tr>
                  ) : expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{fmtDate(exp.expenseDate)}</td>
                      <td className="py-3 px-4">
                        <Badge className={`text-xs border-0 ${CAT_BADGE[exp.category] ?? "bg-muted text-muted-foreground"}`}>
                          {CATEGORIES.find((c) => c.value === exp.category)?.label ?? exp.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{exp.vendor ?? "—"}</td>
                      <td className="py-3 px-4 text-foreground max-w-[200px] truncate" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-foreground">
                        {fmt(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {fmt(exp.taxAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {exp.isRecurring ? (
                          <Badge className="text-xs border-0 bg-primary/10 text-primary">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditing(exp); setDialogOpen(true) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(exp)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ExpenseDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={handleSave}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently delete &ldquo;{deleteTarget?.description}&rdquo;. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
