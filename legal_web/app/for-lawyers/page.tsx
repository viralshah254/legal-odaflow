import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { ForLawyersPageContent } from "@/components/marketing/for-lawyers-page"
import { buildForLawyersMetadata } from "@/lib/seo/site-metadata"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  return buildForLawyersMetadata()
}

export default function ForLawyersPage() {
  return (
    <div className="marketing-light min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main>
        <ForLawyersPageContent />
      </main>
      <CinematicFooter />
    </div>
  )
}
