"use client"

import { CountryLanguageFlow } from "@/components/i18n/country-language-flow"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { useRouter } from "next/navigation"

export default function OnboardingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <div className="mx-auto px-4 py-14 sm:py-20 max-w-lg">
        <CountryLanguageFlow onComplete={() => router.push("/auth")} />
      </div>
    </div>
  )
}
