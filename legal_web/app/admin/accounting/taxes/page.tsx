"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, PiggyBank } from "lucide-react"
import { getAccountingTaxes, type TaxEntry } from "@/lib/api/admin-extended"

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  IN: "India",
  KE: "Kenya",
  ZA: "South Africa",
  AU: "Australia",
  CA: "Canada",
  DE: "Germany",
  FR: "France",
  SG: "Singapore",
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n)
}

function pct(tax: number, gross: number) {
  if (gross === 0) return "—"
  return ((tax / gross) * 100).toFixed(1) + "%"
}

export default function TaxesPage() {
  const [entries, setEntries] = useState<TaxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [country, setCountry] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getAccountingTaxes({
      from: from || undefined,
      to: to || undefined,
      country: country || undefined,
    })
      .then(setEntries)
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }, [from, to, country])

  useEffect(() => { load() }, [load])

  const totalTax = entries.reduce((s, e) => s + e.taxCollected, 0)
  const totalGross = entries.reduce((s, e) => s + e.grossAmount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PiggyBank className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Taxes Collected</h1>
          <p className="text-sm text-muted-foreground">
            {fmt(totalTax)} collected across {entries.length} region{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 text-sm" placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 text-sm" placeholder="To" />
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase())}
          className="w-24 text-sm uppercase"
          placeholder="Country"
          maxLength={2}
        />
        <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); setCountry("") }}>
          Reset
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {totalGross > 0 && (
            <div className="rounded-lg border border-border bg-amber-50 dark:bg-amber-900/10 p-4">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                Overall effective tax rate: {pct(totalTax, totalGross)} &middot; {fmt(totalTax)} on {fmt(totalGross)} gross
              </p>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Country</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Transactions</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Gross Revenue</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Tax Collected</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Eff. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          No tax data found
                        </td>
                      </tr>
                    ) : (
                      entries
                        .sort((a, b) => b.taxCollected - a.taxCollected)
                        .map((row, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-medium text-foreground">
                              {row.countryCode
                                ? `${COUNTRY_NAMES[row.countryCode] ?? row.countryCode} (${row.countryCode})`
                                : <span className="text-muted-foreground">Unknown</span>
                              }
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                              {row.transactions.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-foreground">
                              {fmt(row.grossAmount)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">
                              {fmt(row.taxCollected)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                              {pct(row.taxCollected, row.grossAmount)}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
