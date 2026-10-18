"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { TourHelpTrigger } from "@/components/tutorials/tour-help-trigger"
import { useUIStore } from "@/lib/store"

/**
 * Mobile/tablet top bar for the consumer shell — hamburger lives here so it
 * does not float over page content.
 */
export function ConsumerTopbar() {
  const setConsumerSidebarOpen = useUIStore((s) => s.setConsumerSidebarOpen)
  const consumerSidebarOpen = useUIStore((s) => s.consumerSidebarOpen)

  return (
    <header className="lg:hidden shrink-0 z-40 border-b border-border/50 bg-background pt-safe-top">
      <div className="flex h-14 items-center gap-2 px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setConsumerSidebarOpen(!consumerSidebarOpen)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-sm font-semibold truncate">Umbrella Legal</span>
        <TourHelpTrigger variant="ghost" />
        <ThemeToggle />
      </div>
    </header>
  )
}
