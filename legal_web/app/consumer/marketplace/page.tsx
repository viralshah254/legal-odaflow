"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import {
  FileText,
  ShieldCheck,
  Briefcase,
  Home,
  CreditCard,
  Scale,
  Clock,
  CheckCircle2,
  Star,
  ArrowRight,
  Search,
  Sparkles,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MarketplaceSku {
  id: string
  label: string
  description: string
  icon: React.ElementType
  priceUsd: number
  turnaround: string
  includes: string[]
  category: string
  popular?: boolean
  countries?: string[]
}

const MARKETPLACE_SKUS: MarketplaceSku[] = [
  {
    id: "employment-contract-review",
    label: "Employment contract review",
    description: "A qualified employment lawyer reviews your contract, flags risks, and provides a written summary.",
    icon: Briefcase,
    priceUsd: 79,
    turnaround: "24 hours",
    category: "Employment",
    popular: true,
    includes: [
      "Line-by-line risk review",
      "Plain-English summary",
      "3 specific red flags highlighted",
      "Negotiation tips",
    ],
  },
  {
    id: "nda-review",
    label: "NDA review & redline",
    description: "Attorney reviews a mutual or one-sided NDA and returns marked-up redlines with commentary.",
    icon: FileText,
    priceUsd: 59,
    turnaround: "24 hours",
    category: "Corporate",
    includes: [
      "Redlined document returned",
      "Explanation of every change",
      "Scope and duration analysis",
      "Enforcement risk note",
    ],
  },
  {
    id: "demand-letter",
    label: "Demand letter drafting",
    description: "Attorney-drafted formal demand letter to recover a debt, damages, or enforce a contract.",
    icon: Scale,
    priceUsd: 49,
    turnaround: "48 hours",
    category: "Dispute resolution",
    popular: true,
    includes: [
      "Jurisdictionally compliant letter",
      "Legal basis for claim",
      "Demand with deadline",
      "Delivery tracking",
    ],
  },
  {
    id: "tenant-consultation",
    label: "Tenant rights consultation",
    description: "30-minute video call with a housing lawyer to understand your rights as a tenant.",
    icon: Home,
    priceUsd: 49,
    turnaround: "Same day",
    category: "Housing",
    includes: [
      "30-minute video consultation",
      "Written follow-up summary",
      "Relevant statute references",
      "Action plan",
    ],
  },
  {
    id: "compliance-check",
    label: "Business compliance check",
    description: "Spot-check your business for common regulatory compliance issues in your jurisdiction.",
    icon: ShieldCheck,
    priceUsd: 149,
    turnaround: "3 days",
    category: "Compliance",
    includes: [
      "Regulatory checklist review",
      "Licensing and permit gaps",
      "Data protection basics",
      "Written compliance memo",
    ],
  },
  {
    id: "side-letter",
    label: "Side letter / amendment drafting",
    description: "Draft a short-form side letter or amendment to an existing agreement.",
    icon: CreditCard,
    priceUsd: 89,
    turnaround: "48 hours",
    category: "Corporate",
    includes: [
      "Bespoke draft for your agreement",
      "Legally effective amendment structure",
      "One round of revisions",
      "Execution guidance",
    ],
  },
]

const CATEGORIES = ["All", "Employment", "Corporate", "Dispute resolution", "Housing", "Compliance"]

export default function MarketplacePage() {
  const searchParams = useSearchParams()
  const { countryCode } = useDetectedCountry()
  const [activeCategory, setActiveCategory] = useState("All")
  const [search, setSearch] = useState("")
  const highlightedSku = searchParams.get("sku")
  const [requestedSku, setRequestedSku] = useState<MarketplaceSku | null>(null)
  const [requestSubmitted, setRequestSubmitted] = useState(false)

  const filtered = MARKETPLACE_SKUS.filter((s) => {
    if (s.countries?.length && countryCode && !s.countries.includes(countryCode)) return false
    if (activeCategory !== "All" && s.category !== activeCategory) return false
    if (search && !s.label.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Fixed-fee legal services
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Legal marketplace</h1>
        <p className="text-muted-foreground text-sm">
          Professional legal services with transparent flat fees — delivered by qualified lawyers.
        </p>
      </div>

      {/* Search + category filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-muted/30 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SKU grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="marketplace-skus">
        {filtered.map((sku) => {
          const Icon = sku.icon
          const isHighlighted = sku.id === highlightedSku
          return (
            <Card
              key={sku.id}
              className={cn(
                "transition-all hover:shadow-md",
                isHighlighted && "ring-2 ring-primary",
                sku.popular && "border-primary/30",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {sku.popular && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border border-primary/20">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        Popular
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs font-bold">
                      ${sku.priceUsd}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-sm mt-2">{sku.label}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{sku.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1">
                  {sku.includes.map((inc, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      {inc}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-3">
                  <Clock className="h-3.5 w-3.5" />
                  Delivered in {sku.turnaround}
                </div>
                <Button
                  className="w-full gap-2 text-sm"
                  onClick={() => { setRequestedSku(sku); setRequestSubmitted(false) }}
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No services match your search.</p>
        </div>
      )}

      {/* Trust badges */}
      <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <ShieldCheck className="h-6 w-6 text-primary mx-auto mb-1" />
          <p className="text-xs font-semibold">Qualified lawyers</p>
          <p className="text-[10px] text-muted-foreground">All vetted and licensed</p>
        </div>
        <div>
          <CreditCard className="h-6 w-6 text-primary mx-auto mb-1" />
          <p className="text-xs font-semibold">Fixed fee</p>
          <p className="text-[10px] text-muted-foreground">No hidden charges</p>
        </div>
        <div>
          <Clock className="h-6 w-6 text-primary mx-auto mb-1" />
          <p className="text-xs font-semibold">Fast delivery</p>
          <p className="text-[10px] text-muted-foreground">Same-day to 3 days</p>
        </div>
      </div>

      {/* Coming-soon request modal */}
      <Dialog open={!!requestedSku} onOpenChange={(open) => { if (!open) setRequestedSku(null) }}>
        <DialogContent className="max-w-sm">
          {!requestSubmitted ? (
            <>
              <DialogHeader>
                <DialogTitle>Request: {requestedSku?.label}</DialogTitle>
                <DialogDescription>
                  Online checkout is coming soon. Submit a request and a qualified lawyer will contact you within 24 hours to get started.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
                <p className="font-semibold">{requestedSku?.label}</p>
                <p className="text-muted-foreground">{requestedSku?.description}</p>
                <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {requestedSku?.turnaround}
                  <span className="ml-auto font-bold text-foreground">${requestedSku?.priceUsd}</span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setRequestedSku(null)}>Cancel</Button>
                <Button onClick={() => setRequestSubmitted(true)} className="gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Submit request
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Request received
                </DialogTitle>
                <DialogDescription>
                  Your request for <strong>{requestedSku?.label}</strong> has been submitted. A lawyer will contact you within 24 hours to confirm details and begin work.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setRequestedSku(null)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
