import type { Metadata } from "next"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { ForLawFirmsPageContent } from "@/components/marketing/for-law-firms-page"
import { buildForLawFirmsMetadata } from "@/lib/seo/site-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return buildForLawFirmsMetadata()
}

export default function ForLawFirmsPage() {
  return (
    <div className="marketing-light min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main>
        <ForLawFirmsPageContent />
      </main>
      <CinematicFooter />
    </div>
  )
}
