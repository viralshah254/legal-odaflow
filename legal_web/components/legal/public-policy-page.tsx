import Link from "next/link"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface PublicPolicyPageProps {
  title: string
  description: string
  lastUpdated?: string
  homeLabel?: string
  lastUpdatedLabel?: string
  children: React.ReactNode
}

export function PublicPolicyPage({
  title,
  description,
  lastUpdated = "May 2026",
  homeLabel = "Home",
  lastUpdatedLabel,
  children,
}: PublicPolicyPageProps) {
  const lastUpdatedText = lastUpdatedLabel ?? `Last updated: ${lastUpdated}`

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 max-w-3xl w-full">
        <Link href="/">
          <Button variant="ghost" className="mb-6 rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {homeLabel}
          </Button>
        </Link>
        <h1 className="text-4xl font-semibold tracking-[-.05em] text-slate-950 mb-2">{title}</h1>
        <p className="text-slate-600 mb-1">{description}</p>
        <p className="text-xs text-slate-400 mb-8">{lastUpdatedText}</p>
        <div className="prose prose-sm max-w-none space-y-6">{children}</div>
        <div className="mt-10">
          <LegalDisclaimer />
        </div>
      </div>
      <CinematicFooter />
    </div>
  )
}
