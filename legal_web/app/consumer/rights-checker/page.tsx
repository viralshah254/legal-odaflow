"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import {
  Home,
  Briefcase,
  CreditCard,
  Scale,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RightsScenario {
  id: string
  label: string
  icon: React.ElementType
  question: string
  description: string
  rights: string[]
  steps: string[]
  href: string
  countries?: string[]
}

const RIGHTS_SCENARIOS: RightsScenario[] = [
  {
    id: "housing",
    label: "Housing rights",
    icon: Home,
    question: "Did someone violate your housing rights?",
    description: "Evictions, landlord disputes, security deposits, habitability issues.",
    rights: [
      "Right to proper written notice before eviction",
      "Right to habitable premises (heat, water, safety)",
      "Right to return of security deposit with accounting",
      "Protection against retaliatory eviction",
    ],
    steps: [
      "Document all communications with your landlord in writing",
      "Photograph any property defects and date the images",
      "Review your lease for notice periods and dispute clauses",
      "File a complaint with your local housing authority if violated",
    ],
    href: "/consumer/cases/new?issueType=HOUSING",
  },
  {
    id: "employment",
    label: "Employment rights",
    icon: Briefcase,
    question: "Did your employer violate your rights?",
    description: "Unpaid wages, unfair dismissal, harassment, discrimination.",
    rights: [
      "Right to receive agreed wages on time",
      "Protection against unfair or wrongful dismissal",
      "Right to a safe working environment",
      "Right to join a trade union",
    ],
    steps: [
      "Save all payslips, contracts, and written warnings",
      "Raise a formal grievance with HR in writing",
      "File a complaint with the labour authority within the limitation period",
      "Seek legal advice if the employer does not respond",
    ],
    href: "/consumer/cases/new?issueType=EMPLOYMENT",
  },
  {
    id: "consumer",
    label: "Consumer rights",
    icon: CreditCard,
    question: "Were you misled or sold defective goods?",
    description: "Defective products, mis-selling, refund denial, unfair contracts.",
    rights: [
      "Right to a refund or replacement for defective goods",
      "Right to accurate product information",
      "Protection against unfair contract terms",
      "Right to redress for mis-sold financial products",
    ],
    steps: [
      "Keep receipts, invoices, and all product packaging",
      "Write a formal complaint letter to the seller",
      "Escalate to the consumer forum if unresolved in 30 days",
      "Seek compensation for damages suffered",
    ],
    href: "/consumer/cases/new?issueType=CONSUMER",
  },
  {
    id: "fees",
    label: "Fee disputes",
    icon: Scale,
    question: "Were you charged unfair or undisclosed fees?",
    description: "Banking fees, professional fees, hidden charges, overcharging.",
    rights: [
      "Right to a fee schedule before engagement",
      "Protection against undisclosed charges",
      "Right to an itemised bill from professionals",
      "Right to dispute unreasonable professional fees",
    ],
    steps: [
      "Request an itemised statement of all fees charged",
      "Compare against the agreed fee schedule",
      "Raise a written dispute with the service provider",
      "Complain to the relevant regulatory body if unresolved",
    ],
    href: "/consumer/cases/new?issueType=FEES",
  },
]

export default function RightsCheckerPage() {
  const { countryCode } = useDetectedCountry()
  const [selected, setSelected] = useState<RightsScenario | null>(null)

  const visible = RIGHTS_SCENARIOS.filter(
    (s) => !s.countries || !countryCode || s.countries.includes(countryCode),
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Shield className="h-3.5 w-3.5" />
          Know your rights
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Rights checker</h1>
        <p className="text-muted-foreground text-sm">
          Find out if your rights were violated — and what you can do about it.
        </p>
      </div>

      {!selected ? (
        /* Scenario selection grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-tour="rights-scenarios">
          {visible.map((scenario) => {
            const Icon = scenario.icon
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setSelected(scenario)}
                className="text-left rounded-xl border p-4 hover:shadow-md hover:border-primary/40 transition-all bg-card group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{scenario.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {scenario.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        /* Scenario detail */
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            ← Back to all topics
          </button>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <selected.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{selected.question}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Your rights */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Your rights
                </p>
                <ul className="space-y-1.5">
                  {selected.rights.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps to take */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Steps to take
                </p>
                <ol className="space-y-1.5">
                  {selected.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* CTA */}
              <div className="border-t pt-4 space-y-2">
                <Button className="w-full gap-2" asChild>
                  <Link href={selected.href}>
                    <Scale className="h-4 w-4" />
                    Start a case with AI analysis
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Link>
                </Button>
                <Button variant="outline" className="w-full gap-2" asChild>
                  <Link href="/consumer/find-lawyer">
                    Find a lawyer for this issue
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fixed-fee services section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Fixed-fee services</h2>
          <Badge variant="secondary" className="text-[10px]">From $49</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Professional legal services with a transparent flat fee — no billing surprises.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: "Employment contract review", price: "$79", href: "/consumer/marketplace?sku=employment-contract-review" },
            { label: "Demand letter drafting", price: "$49", href: "/consumer/marketplace?sku=demand-letter" },
            { label: "NDA review & redline", price: "$59", href: "/consumer/marketplace?sku=nda-review" },
            { label: "Tenant rights consultation", price: "$49", href: "/consumer/marketplace?sku=tenant-consultation" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 hover:border-primary/30 transition-all group"
            >
              <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</span>
              <Badge variant="outline" className="text-xs shrink-0">{item.price}</Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
