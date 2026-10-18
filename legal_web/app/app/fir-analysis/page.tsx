"use client"

import { useDetectedCountry } from "@/lib/contexts/country-context"
import { FirUploader } from "@/components/fir/fir-uploader"
import { Shield } from "lucide-react"

export default function FirAnalysisPage() {
  const { countryCode, isLoading } = useDetectedCountry()

  if (!isLoading && countryCode !== "IN") {
    return (
      <div className="flex items-center justify-center p-6 min-h-[400px]">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">India Only</h1>
          <p className="text-gray-600 dark:text-gray-400">
            FIR intelligence is only available for India. Your jurisdiction: <strong>{countryCode}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8" data-tour="fir-intro">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
            🇮🇳 India
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">FIR Analysis</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Upload an FIR to extract structured facts, bail posture, and next legal steps.
        </p>
      </div>
      <div data-tour="fir-uploader">
        <FirUploader context="lawyer" countryCode={countryCode} />
      </div>
    </div>
  )
}
