"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { DraftIntentPanel } from "@/components/legal-forms/draft-intent-panel"
import { DraftHistorySidebar } from "@/components/drafting/draft-history-sidebar"
import { getDraftById, type DraftHistoryItem } from "@/lib/api/draft-history"
import { buildSavedDraftHref } from "@/lib/drafting/draft-navigation"
import {
  Scale,
  ShieldAlert,
  Users,
  FileText,
  Gavel,
  Handshake,
  CreditCard,
  Heart,
  PenLine,
} from "lucide-react"

const QUICK_KINDS = [
  {
    id: "india_maintenance_order_revision",
    label: "Maintenance Revision",
    subtitle: "BNSS §438 / §144",
    icon: Heart,
    category: "Family",
  },
  {
    id: "india_regular_bail_bnss_480",
    label: "Bail Application",
    subtitle: "BNSS §480 / §483",
    icon: ShieldAlert,
    category: "Bail",
  },
  {
    id: "india_criminal_revision",
    label: "Criminal Revision",
    subtitle: "BNSS §438",
    icon: Gavel,
    category: "Criminal",
  },
  {
    id: "india_writ_petition_hc",
    label: "Writ Petition",
    subtitle: "Art. 226 Constitution",
    icon: Scale,
    category: "Constitutional",
  },
  {
    id: "india_consumer_complaint",
    label: "Consumer Complaint",
    subtitle: "CPA 2019 §35",
    icon: Users,
    category: "Consumer",
  },
  {
    id: "india_cheque_bounce_complaint_ni138",
    label: "Cheque Bounce",
    subtitle: "NI Act §138",
    icon: CreditCard,
    category: "Criminal",
  },
  {
    id: "india_divorce_petition_s13",
    label: "Divorce Petition",
    subtitle: "HMA §13",
    icon: FileText,
    category: "Family",
  },
  {
    id: "india_nda_india",
    label: "Non-Disclosure Agreement",
    subtitle: "India law",
    icon: Handshake,
    category: "Commercial",
  },
]

export default function IndiaDraftingPage() {
  const router = useRouter()
  const { activeTenantId } = useTenant()
  const [inferredJurisdiction, setInferredJurisdiction] = React.useState<string>("")

  const handleQuickPick = (kind: (typeof QUICK_KINDS)[number]) => {
    const params = new URLSearchParams({
      kind: kind.id,
      label: kind.label,
      category: kind.category,
    })
    if (inferredJurisdiction) params.set("jurisdiction", inferredJurisdiction)
    router.push(`/app/india-drafting/draft?${params.toString()}`)
  }

  const handleHistorySelect = (item: DraftHistoryItem) => {
    if (!activeTenantId) return
    void getDraftById(item.id, activeTenantId).then((record) => {
      router.push(buildSavedDraftHref(record))
    })
  }

  const formatsHref = inferredJurisdiction
    ? `/app/india-drafting/formats?jurisdiction=${inferredJurisdiction}`
    : "/app/india-drafting/formats"

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col xl:flex-row xl:gap-6 xl:items-start">
        <div className="flex-1 min-w-0 space-y-8">
          {/* Header */}
          <div data-tour="india-drafting-intro">
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Describe what you need or pick a document type below. The AI will produce a court-ready draft referencing current BNS/BNSS/BSA 2023.
            </p>
          </div>

          {/* Smart intent panel */}
          <div data-tour="india-drafting-workspace">
            <DraftIntentPanel
            countryCode="IN"
            onJurisdictionInferred={setInferredJurisdiction}
          />

          {/* Quick-pick grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Common documents
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_KINDS.map((kind) => {
                const Icon = kind.icon
                return (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => handleQuickPick(kind)}
                    className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-left hover:border-indigo-400 hover:shadow-sm transition-all group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                      <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                        {kind.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {kind.subtitle}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          </div>

          {/* Draft freely CTA */}
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Can&apos;t find what you need?
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Describe any document in plain language — petition, agreement, notice, complaint — and the AI figures out the rest.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/app/india-drafting/draft?kind=india_custom&label=Custom+Draft&category=Custom",
                )
              }
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              <PenLine className="h-4 w-4" />
              Draft freely
            </button>
          </div>

          {/* Browse all link */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need something else?{" "}
            <a
              href={formatsHref}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              Browse all 400+ India document types
            </a>
            {" or "}
            <a
              href="/app/legal-forms"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              search official legal forms catalog
            </a>
            .
          </p>
        </div>

        {/* Sidebar — draft history */}
        <DraftHistorySidebar
          tenantId={activeTenantId ?? undefined}
          countryCode="IN"
          onSelect={handleHistorySelect}
          collapsible
        />
      </div>
    </div>
  )
}
