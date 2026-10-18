"use client"

import { useDetectedCountry } from "@/lib/contexts/country-context"
import { IndiaDraftingWorkspace } from "@/components/india-drafting/india-drafting-workspace"
import { Shield } from "lucide-react"

export default function IndiaDraftingConsumerPage() {
  const { countryCode, isLoading } = useDetectedCountry()

  if (!isLoading && countryCode !== "IN") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">India Only</h1>
          <p className="text-gray-600 dark:text-gray-400">
            India court drafting formats are only available for India.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14" data-tour="consumer-india-drafting-intro">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
              🇮🇳 India
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            India Court Drafts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Get a starting-point draft for Indian court applications — bail, maintenance, consumer complaints, legal notices and more.
            All formats reference BNS/BNSS/BSA 2023.
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-8" data-tour="consumer-india-drafting-workspace">
        <IndiaDraftingWorkspace context="consumer" templateBasePath="/consumer/india-drafting" />
      </div>
    </div>
  )
}
