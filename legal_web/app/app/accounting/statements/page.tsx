"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useTenant } from "@/lib/contexts/tenant-context"
import { downloadStatementPdf } from "@/lib/api/billing"
import { getClientStatements } from "@/lib/api/finance"
import { Download, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/hooks/use-toast"

export default function StatementsPage() {
  const toFixed = useTranslations("billing")
  const t = useTranslations("billing")
  const tAdmin = useTranslations("admin")
  const tErr = useTranslations("errors")
  const { activeTenantId } = useTenant()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Awaited<ReturnType<typeof getClientStatements>> | null>(null)

  const generate = async () => {
    if (!activeTenantId) return
    setLoading(true)
    setError("")
    try {
      const data = await getClientStatements(activeTenantId, {
        from: from || undefined,
        to: to || undefined,
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate statements")
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async (clientId?: string) => {
    if (!activeTenantId) return
    setDownloadingPdf(true)
    try {
      const blob = await downloadStatementPdf(activeTenantId, {
        clientId,
        from: from || undefined,
        to: to || undefined,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `statement-${clientId ?? "all"}-${Date.now()}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast({ title: tErr("toast.pdfDownloaded") })
    } catch {
      toast({ title: tErr("toast.pdfDownloadFailed"), variant: "destructive" })
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("statements")}</h1>
        <p className="text-muted-foreground">{t("generate_client_account_statements")}</p>
      </div>

      <Card data-tour="statements-list">
        <CardHeader>
          <CardTitle>{t("statements")}</CardTitle>
          <CardDescription>{t("select_date_range_and_generate_statements")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="from">{tAdmin("from")}</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void generate()} disabled={loading || !activeTenantId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate Statement"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadPdf()}
              disabled={downloadingPdf || !activeTenantId}
            >
              {downloadingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground items-center">
            <span>
              Period: {format(new Date(result.period.from), "MMM d, yyyy")} –{" "}
              {format(new Date(result.period.to), "MMM d, yyyy")}
            </span>
            <span>{result.summary.clientCount} clients</span>
            <span>Balance due: {result.summary.totalBalanceDue.toFixed(2)}</span>
          </div>
          {result.clients.map((client) => (
            <Card key={client.clientId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{client.clientName}</CardTitle>
                    <CardDescription>
                      Invoiced {client.totalInvoiced.toFixed(2)} · Paid {client.totalPaid.toFixed(2)} · Due{" "}
                      <Badge variant={client.balanceDue > 0 ? "destructive" : "secondary"}>
                        {client.balanceDue.toFixed(2)}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadPdf(client.clientId)}
                    disabled={downloadingPdf}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {client.invoices.map((inv) => (
                    <li key={inv.id} className="flex justify-between border-b py-1">
                      <span>{inv.invoiceNumber}</span>
                      <span>
                        {Number(inv.amount).toFixed(2)} · {inv.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
