"use client"
import { useTranslations } from "next-intl"

import { usePathname } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/lib/store"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { cn } from "@/lib/utils"

/** Matter detail + workspace routes render MatterInlineCopilot — hide FAB to avoid overlap. */
function isMatterInlineCopilotRoute(pathname: string): boolean {
  // /app/matters/[id] or /app/matters/[id]/... but not /app/matters or /app/matters/new
  return /^\/app\/matters\/[^/]+/.test(pathname) && !pathname.startsWith("/app/matters/new")
}

/** Persistent floating Copilot entry point on CRM pages. */
export function CopilotFloatingButton() {
  const t = useTranslations("copilot")
  const tCommon = useTranslations("common")
  const pathname = usePathname()
  const setCopilotDrawerOpen = useUIStore((state) => state.setCopilotDrawerOpen)
  const { canOpenCopilot } = useCopilotContext()
  const isDraftingWorkspace = pathname.startsWith("/app/india-drafting/draft")

  if (!canOpenCopilot) return null
  if (isMatterInlineCopilotRoute(pathname)) return null

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "md:bottom-8 md:right-8",
        isDraftingWorkspace && "bottom-24 md:bottom-8",
      )}
    >
      {/* Animated glow ring */}
      <span
        className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary pointer-events-none"
        style={{ animationDuration: "2.4s" }}
        aria-hidden
      />
      <Button
        size="lg"
        className={cn(
          "relative h-12 rounded-full shadow-xl",
          // Icon-only on small screens, pill with label on md+
          "w-12 md:w-auto md:px-5 md:gap-2",
        )}
        onClick={() => setCopilotDrawerOpen(true)}
        title={tCommon("open_copilot_shiftcmdk")}
        aria-label={t("open")}
        data-tour="copilot-fab"
      >
        <Sparkles className="h-5 w-5 shrink-0" />
        <span className="hidden md:inline font-semibold tracking-tight">AI Copilot</span>
      </Button>
    </div>
  )
}
