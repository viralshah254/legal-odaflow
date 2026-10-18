"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Sparkles,
  Search,
  ArrowRight,
  Scale,
  FileSearch,
  BookOpen,
  FileText,
  ChevronDown,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { COUNTRY_NAMES } from "@/lib/geo/detect-country"
import { cn } from "@/lib/utils"

const SEARCH_COUNTRIES = ["KE", "IN", "US", "GB"]

// Modes with an inline form stay on this card.
// "nav" modes navigate directly to their page.
type InlineMode = "research" | "intake"
type NavMode    = "document-review" | "section-finder" | "draft-forms"
type Mode = InlineMode | NavMode

interface ModeConfig {
  id: Mode
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string          // if set → navigate immediately on select
  indiaOnly?: boolean
  /** Tailwind colour token prefix used for icon + accent */
  color: "primary" | "violet" | "orange" | "rose" | "emerald"
}

const MODE_CONFIGS: ModeConfig[] = [
  {
    id: "research",
    label: "Legal Research",
    icon: Sparkles,
    color: "primary",
  },
  {
    id: "document-review",
    label: "Document Review",
    icon: FileSearch,
    href: "/app/document-review",
    color: "violet",
  },
  {
    id: "section-finder",
    label: "Section Finder",
    icon: BookOpen,
    href: "/app/section-finder",
    indiaOnly: true,
    color: "orange",
  },
  {
    id: "draft-forms",
    label: "Document Drafting",
    icon: FileText,
    href: "/app/legal-forms",
    color: "violet",
  },
  {
    id: "intake",
    label: "New Intake",
    icon: Scale,
    color: "emerald",
  },
]

const COLOR_MAP: Record<
  ModeConfig["color"],
  { icon: string; ring: string; bg: string; border: string; glow: string; cta: string }
> = {
  primary: {
    icon: "text-primary",
    ring: "ring-primary/30",
    bg: "bg-primary/20",
    border: "border-primary/25",
    glow: "bg-primary/10",
    cta: "",
  },
  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/15",
    border: "border-violet-500/25",
    glow: "bg-violet-500/10",
    cta: "bg-violet-600 hover:bg-violet-700 text-white",
  },
  orange: {
    icon: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/30",
    bg: "bg-orange-500/15",
    border: "border-orange-500/25",
    glow: "bg-orange-500/10",
    cta: "bg-orange-600 hover:bg-orange-700 text-white",
  },
  rose: {
    icon: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
    bg: "bg-rose-500/15",
    border: "border-rose-500/25",
    glow: "bg-rose-500/10",
    cta: "bg-rose-600 hover:bg-rose-700 text-white",
  },
  emerald: {
    icon: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/25",
    glow: "bg-emerald-500/10",
    cta: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
}

const GRADIENT_FROM: Record<ModeConfig["color"], string> = {
  primary: "from-primary/[0.12]",
  violet:  "from-violet-500/[0.10]",
  orange:  "from-orange-500/[0.10]",
  rose:    "from-rose-500/[0.10]",
  emerald: "from-emerald-500/[0.10]",
}

export function DashboardAISearch() {
  const t  = useTranslations("dashboard.aiSearch")
  const tc = useTranslations("common")
  const router = useRouter()
  const { activeTenant } = useTenant()
  const { countryCode } = useDetectedCountry()
  const defaultCountry = activeTenant?.tenant.primaryCountry ?? countryCode ?? "IN"

  const [mode, setMode]       = useState<Mode>("research")
  const [query, setQuery]     = useState("")
  const [country, setCountry] = useState(defaultCountry)
  const [brief, setBrief]     = useState("")
  const [client, setClient]   = useState("")

  useEffect(() => {
    setCountry(defaultCountry)
  }, [defaultCountry])

  const visibleModes = useMemo(
    () => MODE_CONFIGS.filter((m) => !m.indiaOnly || countryCode === "IN"),
    [countryCode],
  )

  const chips = useMemo(() => {
    const countryPrompts = t.raw(`prompts.${country}`) as string[] | undefined
    const defaultPrompts = t.raw("prompts.default") as string[]
    return countryPrompts ?? defaultPrompts
  }, [country, t])

  const handleSelect = (selected: Mode) => {
    const config = MODE_CONFIGS.find((m) => m.id === selected)!
    if (config.href) {
      router.push(config.href)
    } else {
      setMode(selected)
    }
  }

  const goResearch = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/app/research?q=${encodeURIComponent(trimmed)}&country=${country}`)
  }

  const startIntake = () => {
    const params = new URLSearchParams()
    if (brief.trim())  params.set("brief",  brief.trim())
    if (client.trim()) params.set("client", client.trim())
    router.push(`/app/intake${params.size ? `?${params}` : ""}`)
  }

  const countryOptions = useMemo(() => {
    const set = new Set([defaultCountry, ...SEARCH_COUNTRIES])
    return Array.from(set)
  }, [defaultCountry])

  const activeConfig = MODE_CONFIGS.find((m) => m.id === mode)!
  const ActiveIcon   = activeConfig.icon
  const colors       = COLOR_MAP[activeConfig.color]
  const gradientFrom = GRADIENT_FROM[activeConfig.color]

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-6 transition-all duration-300",
        colors.border,
        `bg-gradient-to-br ${gradientFrom} via-[hsl(var(--card))] to-[hsl(var(--card))]`,
        "shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.15)]",
      )}
    >
      {/* Decorative glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl transition-colors duration-300",
          colors.glow,
        )}
      />

      <div className="relative">
        {/* ── Mode switcher header ── */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <div
            className={cn(
              "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl ring-1 shrink-0 transition-all duration-300",
              colors.bg,
              colors.ring,
            )}
          >
            <ActiveIcon
              className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors duration-300", colors.icon)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-1 text-sm font-semibold",
                  "transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="leading-tight">{activeConfig.label}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-56">
              {/* Always-visible tools */}
              {visibleModes
                .filter((m) => !m.indiaOnly)
                .map(({ id, label, icon: Icon, color, href }) => (
                  <DropdownMenuItem
                    key={id}
                    onSelect={() => handleSelect(id)}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", COLOR_MAP[color].icon)} />
                    <span className="flex-1 text-sm">{label}</span>
                    {href && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground/60 ml-auto" />
                    )}
                    {!href && mode === id && (
                      <Check className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    )}
                  </DropdownMenuItem>
                ))}

              {/* India-specific tools */}
              {visibleModes.some((m) => m.indiaOnly) && (
                <>
                  <DropdownMenuSeparator />
                  {visibleModes
                    .filter((m) => m.indiaOnly)
                    .map(({ id, label, icon: Icon, color }) => (
                      <DropdownMenuItem
                        key={id}
                        onSelect={() => handleSelect(id)}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", COLOR_MAP[color].icon)} />
                        <span className="flex-1 text-sm">{label}</span>
                        <span className="text-[10px] font-bold">🇮🇳</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/60 ml-1" />
                      </DropdownMenuItem>
                    ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <p className="text-xs text-muted-foreground hidden sm:block ml-auto">
            {mode === "intake" ? t("intakeSubtitle") : t("subtitle")}
          </p>
        </div>

        {/* ── Research mode ── */}
        {mode === "research" && (
          <>
            <form
              onSubmit={(e) => { e.preventDefault(); goResearch(query) }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("placeholder")}
                  className="pl-9 h-11 bg-background"
                />
              </div>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="h-11 w-full sm:w-[140px] bg-background shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {COUNTRY_NAMES[code] ?? code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" className="h-11 shrink-0" disabled={!query.trim()}>
                {tc("search")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-2.5 sm:mt-3 hidden sm:flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => goResearch(chip)}
                  className={cn(
                    "rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground",
                    "hover:border-primary/40 hover:text-foreground transition-colors",
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Intake mode ── */}
        {mode === "intake" && (
          <div className="flex flex-col gap-2">
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={t("intakeBriefPlaceholder")}
              rows={2}
              className="resize-none bg-background text-sm leading-snug"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder={t("intakeClientPlaceholder")}
                className="h-10 bg-background flex-1 text-sm"
              />
              <Button
                onClick={startIntake}
                className={cn("h-10 shrink-0", colors.cta)}
              >
                {t("intakeCta")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
