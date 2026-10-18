"use client"

import { useEffect, useState } from "react"
import { Check, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ColorTheme = "classic" | "midnight" | "slate" | "sage"

const STORAGE_KEY = "umbrella-color-theme"
const THEME_CLASSES: ColorTheme[] = ["classic", "midnight", "slate", "sage"]

interface ThemeDefinition {
  id: ColorTheme
  label: string
  description: string
  /** Tailwind-compatible inline swatch colours (light-mode preview) */
  swatchBg: string
  swatchAccent: string
}

const THEMES: ThemeDefinition[] = [
  {
    id: "classic",
    label: "Classic Blue",
    description: "Professional & trustworthy",
    swatchBg: "#f0f4ff",
    swatchAccent: "#2563eb",
  },
  {
    id: "midnight",
    label: "Midnight Gold",
    description: "Premium senior-partner",
    swatchBg: "#0a0f1e",
    swatchAccent: "#f59e0b",
  },
  {
    id: "slate",
    label: "Slate Pro",
    description: "Crisp & minimal",
    swatchBg: "#f1f3f8",
    swatchAccent: "#4f46e5",
  },
  {
    id: "sage",
    label: "Sage Green",
    description: "Warm & approachable",
    swatchBg: "#f0faf5",
    swatchAccent: "#16a34a",
  },
]

function applyTheme(theme: ColorTheme) {
  const root = document.documentElement
  if (theme === "classic") {
    root.removeAttribute("data-color-theme")
  } else {
    root.setAttribute("data-color-theme", theme)
  }
}

export function useColorTheme() {
  const [theme, setThemeState] = useState<ColorTheme>("classic")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ColorTheme | null
      if (stored && THEME_CLASSES.includes(stored)) {
        setThemeState(stored)
        applyTheme(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  const setTheme = (t: ColorTheme) => {
    setThemeState(t)
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // ignore
    }
  }

  return { theme, setTheme }
}

/** Compact icon button for sidebar footer — matches ThemeToggle sizing. */
export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useColorTheme()
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 shrink-0 text-muted-foreground/70 hover:text-foreground"
            title={`Colour theme: ${current.label}`}
            aria-label={`Colour theme: ${current.label}`}
          >
            <Palette className="h-4 w-4" />
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-background"
              style={{ background: current.swatchAccent }}
              aria-hidden
            />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-border/60"
              style={{ background: current.swatchAccent }}
            />
            <Palette className="h-3.5 w-3.5" />
            {current.label}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? "end" : "start"}
        side={compact ? "right" : "top"}
        className="w-56 p-2"
        sideOffset={8}
        collisionPadding={12}
      >
        <p className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Colour theme
        </p>
        <div className="space-y-0.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                "hover:bg-muted/70",
                theme === t.id && "bg-muted",
              )}
            >
              {/* Swatch pair */}
              <span className="flex items-center gap-0.5 shrink-0">
                <span
                  className="h-5 w-5 rounded-md ring-1 ring-border/40"
                  style={{ background: t.swatchBg }}
                />
                <span
                  className="h-5 w-3 rounded-r-md"
                  style={{ background: t.swatchAccent }}
                />
              </span>
              <span className="flex-1 text-left min-w-0">
                <span className="block text-[13px] font-medium leading-tight truncate">
                  {t.label}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-tight">
                  {t.description}
                </span>
              </span>
              {theme === t.id && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Inline card grid variant — used on the Settings page.
 */
export function ThemeSelectorGrid() {
  const { theme, setTheme } = useColorTheme()

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          className={cn(
            "relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150",
            "hover:border-primary/40 hover:shadow-sm",
            theme === t.id
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : "border-border/60",
          )}
        >
          {/* Colour preview bar */}
          <div className="flex w-full h-8 rounded-md overflow-hidden ring-1 ring-border/30">
            <span className="flex-1" style={{ background: t.swatchBg }} />
            <span className="w-1/3" style={{ background: t.swatchAccent }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight">{t.label}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {t.description}
            </p>
          </div>
          {theme === t.id && (
            <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
