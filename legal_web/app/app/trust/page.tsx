"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import {
  addTrustEntry,
  approveTrustEntry,
  createTrustAccount,
  createTrustReconciliation,
  listTrustAccounts,
  listTrustReconciliations,
  rejectTrustEntry,
  type TrustReconciliation,
} from "@/lib/api/billing"
import { apiFetch } from "@/lib/api/client"
import type { ApiTrustAccount } from "@/lib/api/types"
import { useApiData } from "@/lib/hooks/use-api-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { formatCurrencyWithSymbol } from "@/lib/utils"
import { useCurrency } from "@/lib/contexts/currency-context"
import { format } from "date-fns"
import { Loader2, Plus, Scale, Shield, CheckCircle2, XCircle, AlertTriangle, HelpCircle, ChevronDown, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listMatters } from "@/lib/api/matters"
import { useQueryClient } from "@tanstack/react-query"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TrustPage() {
  const transaction = useTranslations("lawyer")
  const toFixed = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const tDashboard = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tConsumer = useTranslations("consumer")
  const tAdmin = useTranslations("admin")
  const tCopilot = useTranslations("copilot")
  const { currency, currencyCode } = useCurrency()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [entryAccountId, setEntryAccountId] = useState("")
  const [entryType, setEntryType] = useState<"DEPOSIT" | "DISBURSEMENT">("DEPOSIT")
  const [entryAmount, setEntryAmount] = useState("")
  const [entryMatterId, setEntryMatterId] = useState("none")
  const [entryDescription, setEntryDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [reconAccountId, setReconAccountId] = useState("")
  const [reconStart, setReconStart] = useState("")
  const [reconEnd, setReconEnd] = useState("")
  const [creatingRecon, setCreatingRecon] = useState(false)
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountCurrency, setNewAccountCurrency] = useState(currencyCode)
  const [creatingAccount, setCreatingAccount] = useState(false)

  const { data: apiAccounts = [], isLoading, error } = useApiData<ApiTrustAccount[]>(
    ["trust-accounts", activeTenantId],
    {
      apiFn: () => listTrustAccounts(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const { data: matters = [] } = useApiData(
    ["matters", activeTenantId],
    { apiFn: () => listMatters(activeTenantId!), enabled: !!activeTenantId },
  )

  const { data: reconciliations = [], isLoading: reconciliationsLoading } = useApiData<TrustReconciliation[]>(
    ["trust-reconciliations", activeTenantId, reconAccountId],
    {
      apiFn: () =>
        listTrustReconciliations(
          reconAccountId,
          activeTenantId!,
        ),
      enabled: !!activeTenantId && !!reconAccountId,
    },
  )

  const accounts = useMemo(() => {
    return apiAccounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      balance: typeof acc.balance === "string" ? parseFloat(acc.balance) : acc.balance,
      currency: acc.currency,
      transactions: (acc.entries ?? []).map((e) => ({
        id: e.id,
        type: e.type as "DEPOSIT" | "DISBURSEMENT",
        amount: typeof e.amount === "string" ? parseFloat(e.amount) : e.amount,
        description: e.description ?? "",
        status: e.status as "COMPLETED" | "PENDING" | "REJECTED",
        createdAt: e.createdAt,
      })),
    }))
  }, [apiAccounts])

  const pending = useMemo(
    () =>
      accounts.flatMap((a) =>
        a.transactions
          .filter((t) => t.type === "DISBURSEMENT" && t.status === "PENDING")
          .map((t) => ({ ...t, accountId: a.id, accountName: a.name })),
      ),
    [accounts],
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["trust-accounts", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["trust-reconciliations", activeTenantId] })
  }

  const handleCreateReconciliation = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeTenantId || !reconAccountId || !reconStart || !reconEnd) return
    setCreatingRecon(true)
    try {
      await createTrustReconciliation(reconAccountId, activeTenantId!, {
        periodStart: reconStart,
        periodEnd: reconEnd,
      })
      setReconStart("")
      setReconEnd("")
      invalidate()
    } finally {
      setCreatingRecon(false)
    }
  }

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeTenantId || !newAccountName.trim()) return
    setCreatingAccount(true)
    try {
      const created = await createTrustAccount(activeTenantId, {
        name: newAccountName.trim(),
        currency: newAccountCurrency,
      })
      setNewAccountName("")
      setEntryAccountId(created.id)
      setReconAccountId(created.id)
      invalidate()
    } finally {
      setCreatingAccount(false)
    }
  }

  const handleAddEntry = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeTenantId || !entryAccountId) return
    const amount = parseFloat(entryAmount)
    if (Number.isNaN(amount) || amount <= 0) return
    setSubmitting(true)
    try {
      await addTrustEntry(activeTenantId, entryAccountId, {
        type: entryType,
        amount,
        matterId: entryMatterId !== "none" ? entryMatterId : undefined,
        description: entryDescription.trim() || "",
      })
      setEntryAmount("")
      setEntryDescription("")
      invalidate()
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" data-tour="trust-balances">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("trust_accounts")}</h1>
          <p className="text-muted-foreground">
            Manage trust accounts and transactions.
          </p>
        </div>
        <OpenCopilotButton />
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-destructive">
            Failed to load trust accounts
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">{t("accounts")}</TabsTrigger>
          <TabsTrigger value="reconciliation">{t("reconciliation")}</TabsTrigger>
          <TabsTrigger value="compliance">{tDashboard("compliance")}</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {accounts.length === 0 ? "Create your first trust account" : "Add trust account"}
          </CardTitle>
          <CardDescription>
            Client funds held in trust (IOLTA-style) must be kept separate from operating accounts.
            Create one account per bank trust account your firm maintains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl" onSubmit={handleCreateAccount}>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="trust-account-name">{tCommon("account_name")}</Label>
              <Input
                id="trust-account-name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder={t("eg_firm_iolta_main")}
              />
            </div>
            <div className="grid gap-2">
              <Label>{tBilling("currency")}</Label>
              <Select value={newAccountCurrency} onValueChange={setNewAccountCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">{tBilling("usd")}</SelectItem>
                  <SelectItem value="INR">{t("inr")}</SelectItem>
                  <SelectItem value="GBP">{t("gbp")}</SelectItem>
                  <SelectItem value="KES">{t("kes")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={creatingAccount || !newAccountName.trim()}>
                {creatingAccount ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("post_trust_transaction")}</CardTitle>
          <CardDescription>
            Deposits post immediately. Disbursements require partner/finance approval before the
            balance is reduced.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a trust account above before posting transactions.
            </p>
          ) : (
          <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={handleAddEntry}>
            <div className="grid gap-2">
              <Label>{tConsumer("nav.account")}</Label>
              <Select value={entryAccountId} onValueChange={setEntryAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("select_account")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{tAdmin("type")}</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as "DEPOSIT" | "DISBURSEMENT")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPOSIT">{t("deposit")}</SelectItem>
                  <SelectItem value="DISBURSEMENT">{t("disbursement")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{tBilling("amount")}</Label>
              <Input value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder={tBilling("000")} />
            </div>
            <div className="grid gap-2">
              <Label>{tBilling("matter")}</Label>
              <Select value={entryMatterId} onValueChange={setEntryMatterId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("no_matter")}</SelectItem>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>{tBilling("description")}</Label>
              <Input value={entryDescription} onChange={(e) => setEntryDescription(e.target.value)} placeholder={t("transaction_note")} />
            </div>
            <div className="md:col-span-6">
              <Button type="submit" disabled={submitting || !entryAccountId || !entryAmount}>
                {submitting ? "Saving..." : entryType === "DEPOSIT" ? "Post deposit" : "Request disbursement"}
              </Button>
            </div>
          </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("trust_balances")}</CardTitle>
          <CardDescription>{t("matter_sub-ledgers_and_account_balances")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tConsumer("nav.account")}</TableHead>
                <TableHead>{tBilling("currency")}</TableHead>
                <TableHead className="text-right">{tBilling("balance")}</TableHead>
                <TableHead className="text-right">{tCopilot("recent_activity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No trust accounts yet.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.currency}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrencyWithSymbol(acc.balance, currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {acc.transactions.length > 0
                        ? `${acc.transactions.length} transaction(s)`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pending_approvals")}</CardTitle>
            <CardDescription>{t("disbursement_requests_awaiting_approval")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending.map((txn) => (
                <div
                  key={txn.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">
                      {formatCurrencyWithSymbol(txn.amount, currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">{txn.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {txn.accountName} · {format(new Date(txn.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="secondary">{t("pending")}</Badge>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!activeTenantId) return
                        await approveTrustEntry(activeTenantId, txn.id)
                        invalidate()
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!activeTenantId) return
                        await rejectTrustEntry(activeTenantId, txn.id)
                        invalidate()
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("recent_transactions")}</CardTitle>
          <CardDescription>{t("latest_deposits_and_disbursements_across_all_accounts")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tBilling("date")}</TableHead>
                <TableHead>{tConsumer("nav.account")}</TableHead>
                <TableHead>{tAdmin("type")}</TableHead>
                <TableHead>{tBilling("description")}</TableHead>
                <TableHead className="text-right">{tBilling("amount")}</TableHead>
                <TableHead>{tAdmin("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const allTxns = accounts.flatMap((a) =>
                  a.transactions.slice(0, 5).map((t) => ({
                    ...t,
                    accountName: a.name,
                  })),
                )
                allTxns.sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )
                const slice = allTxns.slice(0, 20)
                if (slice.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  )
                }
                return slice.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{format(new Date(txn.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-muted-foreground">{txn.accountName}</TableCell>
                    <TableCell>
                      <Badge variant={txn.type === "DEPOSIT" ? "default" : "secondary"}>
                        {txn.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {txn.type === "DEPOSIT" ? "+" : "-"}
                      {formatCurrencyWithSymbol(txn.amount, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          txn.status === "COMPLETED"
                            ? "default"
                            : txn.status === "REJECTED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {txn.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Trust reconciliation
              </CardTitle>
              <CardDescription>
                Period-end reconciliation records for IOLTA compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleCreateReconciliation}>
                <div className="grid gap-2">
                  <Label>{tConsumer("nav.account")}</Label>
                  <Select value={reconAccountId} onValueChange={setReconAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_account")} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("period_start")}</Label>
                  <Input type="date" value={reconStart} onChange={(e) => setReconStart(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>{t("period_end")}</Label>
                  <Input type="date" value={reconEnd} onChange={(e) => setReconEnd(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={creatingRecon || !reconAccountId || !reconStart || !reconEnd}>
                    {creatingRecon ? "Creating…" : "Start reconciliation"}
                  </Button>
                </div>
              </form>

              {reconciliationsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("period")}</TableHead>
                      <TableHead>{t("opening")}</TableHead>
                      <TableHead>{t("closing")}</TableHead>
                      <TableHead>{tAdmin("status")}</TableHead>
                      <TableHead>{t("created")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No reconciliation records yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reconciliations.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell>
                            {rec.periodStart ? format(new Date(rec.periodStart), "MMM d") : "—"} –{" "}
                            {rec.periodEnd ? format(new Date(rec.periodEnd), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>{rec.openingBalance != null ? Number(rec.openingBalance).toFixed(2) : "—"}</TableCell>
                          <TableCell>{rec.closingBalance != null ? Number(rec.closingBalance).toFixed(2) : Number(rec.balance).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={rec.status === "CLOSED" ? "default" : "secondary"}>
                              {rec.status ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(rec.createdAt ?? rec.reconciledAt), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <TrustComplianceChecker tenantId={activeTenantId ?? undefined} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Trust Compliance Checker ──────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { code: "US", label: "🇺🇸 United States (IOLTA)" },
  { code: "GB", label: "🇬🇧 England & Wales (SRA)" },
  { code: "KE", label: "🇰🇪 Kenya (LSK)" },
  { code: "IN", label: "🇮🇳 India (BCI)" },
]

interface ComplianceItem {
  ruleId: string
  title: string
  description: string
  regulation: string
  severity: string
  checkType: string
  status: "PASS" | "FAIL" | "WARNING" | "UNKNOWN"
  detail?: string
  deadline?: string
}

interface ComplianceResult {
  jurisdiction: string
  accountingBody: string
  regulationName: string
  overallStatus: "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW"
  criticalFailures: number
  highFailures: number
  summary: string
  keyRequirements: string[]
  items: ComplianceItem[]
}

function ComplianceStatusIcon({ status }: { status: string }) {
  if (status === "PASS") return <CheckCircle2 className="h-4 w-4 text-green-600" />
  if (status === "FAIL") return <XCircle className="h-4 w-4 text-destructive" />
  if (status === "WARNING") return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />
}

function severityBadge(severity: string) {
  const variants: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
    LOW: "bg-green-100 text-green-700 border-green-200",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${variants[severity] ?? variants.LOW}`}>
      {severity}
    </span>
  )
}

function TrustComplianceChecker({ tenantId }: { tenantId?: string }) {
  const tAdmin = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const [selectedCountry, setSelectedCountry] = useState("KE")
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  async function runCheck() {
    if (!tenantId) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiFetch<ComplianceResult>(
        `/billing/trust-compliance/check/${selectedCountry}`,
        { method: "POST", tenantId },
      )
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run compliance check")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Trust Account Compliance Check
          </CardTitle>
          <CardDescription>
            Run a jurisdiction-specific compliance audit against your trust account data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>{tAdmin("jurisdiction")}</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runCheck} disabled={running || !tenantId}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Run Compliance Check
                </>
              )}
            </Button>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Overall status */}
          <Card className={
            result.overallStatus === "COMPLIANT"
              ? "border-green-300 bg-green-50/50"
              : result.overallStatus === "NON_COMPLIANT"
              ? "border-red-300 bg-red-50/50"
              : "border-amber-300 bg-amber-50/50"
          }>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3">
                  {result.overallStatus === "COMPLIANT" ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : result.overallStatus === "NON_COMPLIANT" ? (
                    <XCircle className="h-8 w-8 text-destructive" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                  )}
                  <div>
                    <p className="font-semibold text-lg">{result.overallStatus.replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted-foreground">{result.summary}</p>
                  </div>
                </div>
                <div className="md:ml-auto text-sm text-muted-foreground space-y-1 md:text-right">
                  <p className="font-medium">{result.jurisdiction}</p>
                  <p>{result.accountingBody}</p>
                  <p className="text-xs">{result.regulationName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("key_requirements")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.keyRequirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Individual rule results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("rule-by-rule_results")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.items.map((item) => (
                  <div
                    key={item.ruleId}
                    className="border rounded-lg overflow-hidden"
                  >
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        setExpandedItem(expandedItem === item.ruleId ? null : item.ruleId)
                      }
                    >
                      <ComplianceStatusIcon status={item.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{item.title}</span>
                          {severityBadge(item.severity)}
                          <Badge variant="outline" className="text-xs">
                            {item.checkType}
                          </Badge>
                        </div>
                        {item.detail && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {item.detail}
                          </p>
                        )}
                      </div>
                      {expandedItem === item.ruleId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {expandedItem === item.ruleId && (
                      <div className="px-4 pb-4 pt-0 border-t bg-muted/20 space-y-2">
                        <p className="text-sm">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{t("regulation")}</span>
                          {item.regulation}
                        </p>
                        {item.deadline && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">{t("deadline")}</span>
                            {item.deadline}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
