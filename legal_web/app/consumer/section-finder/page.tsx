"use client"

import { Suspense } from "react"
import { SectionFinderWorkspace } from "@/components/section-finder/section-finder-workspace"

export default function ConsumerSectionFinderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading section finder…</div>}>
      <div data-tour="section-finder-workspace">
        <SectionFinderWorkspace context="consumer" />
      </div>
    </Suspense>
  )
}
