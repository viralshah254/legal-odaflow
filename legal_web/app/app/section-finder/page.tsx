"use client"

import { useSearchParams } from "next/navigation"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useState } from "react"
import { SectionFinderWorkspace } from "@/components/section-finder/section-finder-workspace"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"
import { PromptLibraryModal } from "@/components/task-patterns/prompt-library-modal"

export default function SectionFinderPage() {
  const searchParams = useSearchParams()
  const { countryCode } = useDetectedCountry()
  const [libraryOpen, setLibraryOpen] = useState(false)

  return (
    <div className="container max-w-5xl py-4 md:py-6 px-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Section Finder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Look up legislation, source references, and related provisions for your selected jurisdiction.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => setLibraryOpen(true)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Patterns
        </Button>
      </div>

      <div data-tour="section-finder-workspace">
        <SectionFinderWorkspace context="lawyer" />
      </div>

      <PromptLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        defaultFeature="section_finder"
        defaultJurisdiction={searchParams.get("country")?.toUpperCase() || countryCode || undefined}
      />
    </div>
  )
}
