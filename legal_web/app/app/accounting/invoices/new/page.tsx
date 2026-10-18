"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Briefcase, Building2, FileText, Plus, Save, Loader2, Trash2 } from "lucide-react"
import { createInvoice } from "@/lib/api/finance"
import { listMatters } from "@/lib/api/matters"
import { listClients } from "@/lib/api/clients"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useCurrency } from "@/lib/contexts/currency-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatNumberWithCommas, parseCommaNumber } from "@/lib/utils"
import type { ApiMatter, ApiClient } from "@/lib/api/types"
import { ApiClientError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type InvoiceFor = "matter" | "client" | "general"

type MilestoneLineItem = {
  description: string
  amount: string
  dueDate: string
}

const INVOICE_FOR_OPTIONS: { value: InvoiceFor; label: string; description: string; icon: React.ElementType }[] = [
  {
    value: "matter",
    label: "Matter",
    description: "Hourly, fixed fee, contingency or milestone billing for a specific case",
    icon: Briefcase,
  },
  {
    value: "client",
    label: "Client",
    description: "Retainer, subscription or advisory fee billed directly to a client",
    icon: Building2,
  },
  {
    value: "general",
    label: "General",
    description: "Platform fees, disbursements or services not tied to a client or matter",
    icon: FileText,
  },
]

export default function NewInvoicePage() {
  const t = useTranslations("billing")
  const router = useRouter()
  const { currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const { currencyCode } = useCurrency()
  const user = currentUser ?? { id: "", name: "User", email: "" }

  const [invoiceFor, setInvoiceFor] = useState<InvoiceFor>("matter")
  const [matterId, setMatterId] = useState<string>("")
  const [clientId, setClientId] = useState<string>("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [billingModel, setBillingModel] = useState<
    "HOURLY" | "FIXED" | "CONTINGENCY" | "MILESTONE" | "SUBSCRIPTION"
  >("HOURLY")
  const [status, setStatus] = useState<"DRAFT" | "SENT">("DRAFT")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contingencyPercent, setContingencyPercent] = useState("")
  const [contingencyTrigger, setContingencyTrigger] = useState("")
  const [lineItems, setLineItems] = useState<MilestoneLineItem[]>([
    { description: "", amount: "", dueDate: "" },
  ])

  const { data: matters = [], isLoading: mattersLoading } = useApiData<ApiMatter[]>(
    ["matters", activeTenantId],
    {
      apiFn: () => listMatters(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: clients = [], isLoading: clientsLoading } = useApiData<ApiClient[]>(
    ["clients", activeTenantId],
    {
      apiFn: () => listClients(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const selectedMatter = matterId ? matters.find((m) => m.id === matterId) : undefined
  const selectedClient = clientId ? clients.find((c) => c.id === clientId) : undefined

  const milestoneTotal = lineItems.reduce(
    (sum, item) => sum + (parseCommaNumber(item.amount) || 0),
    0,
  )

  const canSubmit = () => {
    if (!dueDate || !activeTenantId) return false
    if (invoiceFor === "matter" && !matterId) return false
    if (invoiceFor === "client" && !clientId) return false
    if (billingModel === "MILESTONE") {
      return lineItems.some(
        (item) => item.description.trim() && parseCommaNumber(item.amount) > 0,
      )
    }
    if (billingModel === "CONTINGENCY") {
      const pct = parseCommaNumber(contingencyPercent)
      return pct > 0 && pct <= 100 && contingencyTrigger.trim().length > 0
    }
    if (invoiceFor === "general") return Boolean(description.trim()) && Boolean(amount)
    return Boolean(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit() || !activeTenantId) return

    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        invoiceNumber: `INV-${Date.now()}`,
        amount:
          billingModel === "MILESTONE"
            ? milestoneTotal
            : parseCommaNumber(amount || "0"),
        currency: currencyCode,
        dueDate,
        status,
        billingModel,
        description: description.trim() || undefined,
      }

      // Link to matter or client based on invoiceFor
      if (invoiceFor === "matter" && selectedMatter) {
        payload.matterId = selectedMatter.id
        payload.clientId = selectedMatter.clientId ?? undefined
      } else if (invoiceFor === "client" && selectedClient) {
        payload.clientId = selectedClient.id
      }

      if (billingModel === "MILESTONE") {
        payload.lineItems = lineItems
          .filter((item) => item.description.trim() && parseCommaNumber(item.amount) > 0)
          .map((item) => ({
            description: item.description.trim(),
            amount: parseCommaNumber(item.amount),
            dueDate: item.dueDate || undefined,
          }))
      }

      if (billingModel === "CONTINGENCY") {
        payload.contingencyPercent = parseCommaNumber(contingencyPercent)
        payload.contingencyTrigger = contingencyTrigger.trim()
      }

      await createInvoice(activeTenantId, payload)
      router.push("/app/accounting/invoices")
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create invoice")
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = mattersLoading || clientsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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
          <h1 className="text-2xl font-bold">{t("new_invoice")}</h1>
          <p className="text-muted-foreground text-sm">Create an invoice for a matter, a client, or a general service</p>
        </div>
      </div>

      {/* Invoice For selector */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Invoice for</Label>
        <div className="grid grid-cols-3 gap-3">
          {INVOICE_FOR_OPTIONS.map(({ value, label, description: desc, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setInvoiceFor(value)
                setMatterId("")
                setClientId("")
              }}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all",
                invoiceFor === value
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border/60 hover:border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", invoiceFor === value ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-semibold", invoiceFor === value ? "text-primary" : "")}>{label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("invoice_details")}</CardTitle>
          <CardDescription>{t("fill_in_the_invoice_information_below")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Matter picker */}
            {invoiceFor === "matter" && (
              <div className="space-y-2">
                <Label htmlFor="matter">{t("matter_2")} *</Label>
                <Select value={matterId} onValueChange={setMatterId} required>
                  <SelectTrigger id="matter">
                    <SelectValue placeholder={t("select_a_matter")} />
                  </SelectTrigger>
                  <SelectContent>
                    {matters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.title} — {matter.client?.name ?? "Unknown client"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMatter && (
                  <p className="text-sm text-muted-foreground">
                    Client: {selectedMatter.client?.name ?? "—"}
                  </p>
                )}
              </div>
            )}

            {/* Client picker */}
            {invoiceFor === "client" && (
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={clientId} onValueChange={setClientId} required>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                        {client.clientCode ? ` · ${client.clientCode}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description — always visible, required for general */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description
                {invoiceFor === "general" && " *"}
                {invoiceFor !== "general" && <span className="text-muted-foreground ml-1 text-xs">(optional)</span>}
              </Label>
              <Textarea
                id="description"
                placeholder={
                  invoiceFor === "matter"
                    ? "e.g. Legal services rendered for Q2 — High Court hearing, filings"
                    : invoiceFor === "client"
                      ? "e.g. Monthly retainer — June 2026"
                      : "e.g. Platform subscription fee — annual plan"
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                required={invoiceFor === "general"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {billingModel !== "MILESTONE" && (
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("amount_2")} *</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    placeholder={t("000")}
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
                    required={billingModel !== "CONTINGENCY"}
                  />
                </div>
              )}

              {billingModel === "MILESTONE" && (
                <div className="space-y-2 col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Milestone line items</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLineItems((items) => [
                          ...items,
                          { description: "", amount: "", dueDate: "" },
                        ])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add line
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => {
                              const next = [...lineItems]
                              next[index] = { ...item, description: e.target.value }
                              setLineItems(next)
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder="Amount"
                            inputMode="numeric"
                            value={formatNumberWithCommas(item.amount)}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^\d,.]/g, "")
                              const next = [...lineItems]
                              next[index] = { ...item, amount: cleaned }
                              setLineItems(next)
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="date"
                            value={item.dueDate}
                            onChange={(e) => {
                              const next = [...lineItems]
                              next[index] = { ...item, dueDate: e.target.value }
                              setLineItems(next)
                            }}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={lineItems.length === 1}
                            onClick={() =>
                              setLineItems((items) => items.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total: {formatNumberWithCommas(String(milestoneTotal))} {currencyCode}
                  </p>
                </div>
              )}

              {billingModel === "CONTINGENCY" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="contingencyPercent">Contingency %</Label>
                    <Input
                      id="contingencyPercent"
                      type="text"
                      inputMode="numeric"
                      placeholder="33"
                      value={contingencyPercent}
                      onChange={(e) =>
                        setContingencyPercent(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="contingencyTrigger">Success trigger</Label>
                    <Textarea
                      id="contingencyTrigger"
                      placeholder="e.g. payable upon favorable judgment or settlement"
                      value={contingencyTrigger}
                      onChange={(e) => setContingencyTrigger(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="status">{t("status_2")}</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">{t("draft")}</SelectItem>
                    <SelectItem value="SENT">{t("sent")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingModel">{t("billing_model")}</Label>
              <Select
                value={billingModel}
                onValueChange={(v) =>
                  setBillingModel(v as typeof billingModel)
                }
              >
                <SelectTrigger id="billingModel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">{t("hourly")}</SelectItem>
                  <SelectItem value="FIXED">{t("fixed_fee")}</SelectItem>
                  <SelectItem value="CONTINGENCY">{t("contingency")}</SelectItem>
                  <SelectItem value="MILESTONE">{t("milestone")}</SelectItem>
                  <SelectItem value="SUBSCRIPTION">{t("subscription")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">{t("due_date")} *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-3 pt-4">
              <Link href="/app/accounting/invoices">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={!canSubmit() || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
