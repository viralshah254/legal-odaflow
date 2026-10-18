"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search, FileText, Sparkles, ChevronLeft, ChevronRight, ChevronDown, X, Crown } from "lucide-react"
import Link from "next/link"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { normalizeToSupportedCountry } from "@/lib/geo/detect-country"
import {
  persistLegalFormsCountryFilter,
  readLegalFormsCountryFilter,
} from "@/lib/drafting/draft-navigation"
import {
  fetchLegalFormsPaginated,
  type JurisdictionForm,
} from "@/lib/api/legal-forms"
import { US_STATE_OPTIONS } from "@/lib/us-drafting/formats"
import {
  legalFormDraftLink,
  LEGAL_FORMS_COUNTRY_OPTIONS,
  LEGAL_FORMS_PRACTICE_AREAS,
} from "@/lib/legal-forms/draft-links"
import { practiceAreaLabel } from "@/lib/taxonomy/platform-taxonomy"
import { DraftIntentPanel } from "@/components/legal-forms/draft-intent-panel"
import { DRAFT_CREDIT_COSTS } from "@/lib/credits/draft-credit-costs"
import { StyleSelectorDropdown } from "@/components/drafting/style-selector-dropdown"
import { DraftingStyleSetupDialog } from "@/components/settings/drafting-style-dialog"
import { getUserDraftStyle } from "@/lib/api/user-draft-style"
import { useAuth } from "@/lib/contexts/auth-context"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const STYLE_BANNER_DISMISSED_KEY = "umbrella:style-banner-dismissed"

/** Re-rank server-returned forms by relevance to a plain-text query.
 *  The backend uses synonym expansion (e.g. "divorce" → "petition,family,matrimonial"),
 *  which causes false positives. This re-ranks the results by actual word matches.
 */
function clientRankForms(forms: JurisdictionForm[], query: string): JurisdictionForm[] {
  if (!query.trim() || query.length < 2) return forms
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter((w) => w.length > 1)
  const scored = forms.map((f) => {
    const nameLower = f.formName.toLowerCase()
    const haystack = [
      f.formName, f.authority, f.description ?? "", f.category ?? "", f.practiceArea, f.formNumber ?? "",
    ].join(" ").toLowerCase()
    let score = 0
    if (nameLower.includes(q)) score += 30
    else if (haystack.includes(q)) score += 15
    let allInName = true
    for (const w of words) {
      if (nameLower.includes(w)) score += 5
      else if (haystack.includes(w)) { score += 2; allInName = false }
      else allInName = false
    }
    if (allInName && words.length > 1) score += 10
    return { form: f, score }
  })
  // Keep only forms that actually match at least one query word; sort by score desc
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ form }) => form)
}

type CountryFilter = (typeof LEGAL_FORMS_COUNTRY_OPTIONS)[number]["code"]

type IntentStep = "input" | "context_review" | "results"

interface LegalFormsWorkspaceProps {
  onIntentStepChange?: (step: IntentStep) => void
  returnToHref?: string
  rewriteDraftUrl?: (url: string) => string
}

const INDIA_STATES = [
  { code: "AP", name: "Andhra Pradesh" }, { code: "MH", name: "Maharashtra" },
  { code: "KA", name: "Karnataka" }, { code: "TN", name: "Tamil Nadu" },
  { code: "DL", name: "Delhi" }, { code: "UP", name: "Uttar Pradesh" },
  { code: "GJ", name: "Gujarat" }, { code: "WB", name: "West Bengal" },
  { code: "TS", name: "Telangana" }, { code: "RJ", name: "Rajasthan" },
]

export function LegalFormsWorkspace({
  onIntentStepChange,
  returnToHref,
  rewriteDraftUrl,
}: LegalFormsWorkspaceProps = {}) {
  const router = useRouter()
  const t = useTranslations("drafting")
  const { user } = useAuth()
  const { countryCode: detectedCountry, isLoading: countryLoading } = useDetectedCountry()
  const [forms, setForms] = useState<JurisdictionForm[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [country, setCountry] = useState<CountryFilter>("ALL")
  const [countryReady, setCountryReady] = useState(false)
  const [stateFilter, setStateFilter] = useState("")
  const [practiceArea, setPracticeArea] = useState("")
  const [category, setCategory] = useState("")
  const [intentStep, setIntentStep] = useState<IntentStep>("input")
  const [catalogOpen, setCatalogOpen] = useState(false)
  const hideCatalog = intentStep === "results" || intentStep === "context_review"
  const showCatalog = !hideCatalog && catalogOpen

  // ── Drafting style state ──────────────────────────────────────────────────
  const [styleId, setStyleId] = useState<string>("my_style")
  const [styleReady, setStyleReady] = useState<boolean | null>(null)
  const [showStyleBanner, setShowStyleBanner] = useState(false)
  const [styleSetupOpen, setStyleSetupOpen] = useState(false)

  useEffect(() => {
    const dismissed =
      typeof window !== "undefined" &&
      localStorage.getItem(STYLE_BANNER_DISMISSED_KEY) === "true"
    if (dismissed) return
    getUserDraftStyle()
      .then((s) => {
        setStyleReady(s.status === "ready")
        if (s.status !== "ready") setShowStyleBanner(true)
      })
      .catch(() => {})
  }, [])

  const dismissBanner = () => {
    setShowStyleBanner(false)
    if (typeof window !== "undefined") {
      localStorage.setItem(STYLE_BANNER_DISMISSED_KEY, "true")
    }
  }

  const handleIntentStepChange = (step: IntentStep) => {
    setIntentStep(step)
    onIntentStepChange?.(step)
    if (step === "results" || step === "context_review") {
      setCatalogOpen(false)
    }
  }

  useEffect(() => {
    if (countryLoading || countryReady) return
    const stored = readLegalFormsCountryFilter()
    const supported = normalizeToSupportedCountry(detectedCountry) as CountryFilter
    const initial =
      stored &&
      LEGAL_FORMS_COUNTRY_OPTIONS.some((option) => option.code === stored)
        ? (stored as CountryFilter)
        : supported
    setCountry(initial)
    setCountryReady(true)
  }, [countryLoading, countryReady, detectedCountry])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadForms = useCallback(async () => {
    if (!countryReady) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchLegalFormsPaginated({
        countryCode: country === "ALL" ? undefined : country,
        jurisdiction: stateFilter || undefined,
        practiceArea: practiceArea || undefined,
        category: category || undefined,
        search: search || undefined,
        page,
        limit: 48,
      })
      // Re-rank client-side when there's a text search — the server's synonym expansion
      // returns false positives (e.g. "divorce" matches "Maintenance Petition" via "family").
      const ranked = search ? clientRankForms(res.items, search) : res.items
      setForms(ranked)
      setTotal(search ? ranked.length : res.total)
      setPages(search ? Math.ceil(ranked.length / 48) || 1 : res.pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forms")
      setForms([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [country, stateFilter, practiceArea, category, search, page, countryReady])

  useEffect(() => {
    void loadForms()
  }, [loadForms])

  const jurisdictionOptions = useMemo(() => {
    if (country === "IN") return INDIA_STATES
    if (country === "US" || country === "ALL") return US_STATE_OPTIONS
    return []
  }, [country])

  return (
    <div className="space-y-4">
      {/* Style toolbar row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StyleSelectorDropdown
            userId={user?.id}
            onStyleChange={setStyleId}
          />
          {styleReady && (
            <button
              onClick={() => setStyleSetupOpen(true)}
              className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >
              <Crown className="h-3 w-3" />
              My style: active
            </button>
          )}
        </div>
      </div>

      {/* Style setup banner — shown once if style not configured */}
      {showStyleBanner && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-foreground/80">
              Your AI drafts in a generic style.{" "}
              <button
                className="font-semibold text-primary hover:underline"
                onClick={() => setStyleSetupOpen(true)}
              >
                Personalize to your voice →
              </button>
            </span>
          </div>
          <button
            onClick={dismissBanner}
            className="ml-3 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <DraftIntentPanel
        countryCode={country}
        jurisdiction={stateFilter || undefined}
        onStepChange={handleIntentStepChange}
        returnToHref={returnToHref}
        rewriteDraftUrl={rewriteDraftUrl}
        className={intentStep !== "input" ? "min-h-[min(70vh,720px)]" : undefined}
        onJurisdictionInferred={(code) => {
          // Auto-set the state filter when AI detects location from pasted text
          if (!stateFilter) {
            setStateFilter(code)
            setPage(1)
          }
        }}
      />

      {!hideCatalog && !catalogOpen && (
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="w-full rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-center gap-2"
        >
          <ChevronDown className="h-4 w-4" />
          Browse official forms
        </button>
      )}

      {showCatalog && (
      <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
          <SheetHeader className="pr-8">
            <SheetTitle>Official forms catalog</SheetTitle>
            <SheetDescription>
              Search and draft from 10,800+ official forms without leaving your drafting flow.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/app/us-drafting"
          className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          US Drafting (771 AI kinds)
        </Link>
        <Link
          href="/app/india-drafting"
          className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          India Drafting (387 AI kinds)
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_140px_140px] gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search form name, number, authority…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <select
          value={country}
          onChange={(e) => {
            const next = e.target.value as CountryFilter
            setCountry(next)
            persistLegalFormsCountryFilter(next)
            setStateFilter("")
            setPage(1)
          }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
        >
          {LEGAL_FORMS_COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
          disabled={jurisdictionOptions.length === 0}
        >
          <option value="">All jurisdictions</option>
          {jurisdictionOptions.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        <select
          value={practiceArea}
          onChange={(e) => { setPracticeArea(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
        >
          <option value="">All practice areas</option>
          {LEGAL_FORMS_PRACTICE_AREAS.map((a) => (
            <option key={a} value={a}>{practiceAreaLabel(a)}</option>
          ))}
        </select>
        <input
          type="text"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          placeholder="Category"
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm"
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {loading ? "Loading…" : `${total.toLocaleString()} form${total === 1 ? "" : "s"} in catalog`}
        {!loading && total > 0 && ` · page ${page} of ${pages}`}
        {!countryLoading && country !== "ALL" && country === normalizeToSupportedCountry(detectedCountry) && (
          <> · Showing forms for your region ({LEGAL_FORMS_COUNTRY_OPTIONS.find((c) => c.code === country)?.label ?? country})</>
        )}
        {" · "}
        Every row supports &quot;Draft with AI&quot; via on-demand generation
      </p>

      {loading && (
        <div className="text-sm text-gray-500 py-12 text-center">Loading official forms catalog…</div>
      )}
      {error && (
        <div className="text-sm text-red-600 py-8 text-center">{error}</div>
      )}
      {!loading && !error && forms.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-6 py-12 text-center text-sm text-gray-500">
          No forms match your filters. Try clearing jurisdiction or search terms.
        </div>
      )}
      {!loading && forms.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {forms.map((form) => {
            const href = legalFormDraftLink(form)
            return (
              <div
                key={form.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{form.formName}</p>
                    <p className="text-xs font-mono text-gray-500 truncate">{form.formNumber ?? "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">{form.countryCode}</span>
                  {form.jurisdiction && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-teal-600 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded">{form.jurisdiction}</span>
                  )}
                  {form.category && (
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">{form.category}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{form.authority}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {href && (
                    <button
                      type="button"
                      onClick={() => router.push(href)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Draft with AI
                    </button>
                  )}
                </div>
                {href && (
                  <p className="text-[10px] text-gray-400">
                    {t("generateCreditCost", { credits: DRAFT_CREDIT_COSTS.FULL_DRAFT })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-xs text-gray-500">Page {page} / {pages}</span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
          </div>
        </SheetContent>
      </Sheet>
      )}

      <DraftingStyleSetupDialog
        open={styleSetupOpen}
        onOpenChange={setStyleSetupOpen}
        onStyleReady={() => {
          setStyleReady(true)
          setShowStyleBanner(false)
        }}
      />
    </div>
  )
}
