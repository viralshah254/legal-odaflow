"use client"

import { useDetectedCountry } from "@/lib/contexts/country-context"
import { UsDraftingWorkspace } from "@/components/us-drafting/us-drafting-workspace"
import { Shield } from "lucide-react"

export default function UsDraftingPage() {
  const { countryCode, isLoading } = useDetectedCountry()

  if (!isLoading && countryCode !== "US") {
    return (
      <div className="flex items-center justify-center p-6 min-h-[400px]">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">United States Only</h1>
          <p className="text-gray-600 dark:text-gray-400">
            US federal and state drafting formats are only available for the United States. Your jurisdiction: <strong>{countryCode}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            US
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
            Federal + 50 States + DC
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">US Court Drafting</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Ready-to-customise formats for US federal courts and all 50 states plus DC — civil, criminal, family, tax, bankruptcy, immigration, and more.
        </p>
      </div>
      <div data-tour="us-drafting-workspace">
        <UsDraftingWorkspace />
      </div>
    </div>
  )
}
