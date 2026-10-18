import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { DemoPageContent } from "@/components/marketing/demo-page"

export default function DemoTourPage() {
  return (
    <div className="marketing-light min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <main>
        <DemoPageContent />
      </main>
      <CinematicFooter />
    </div>
  )
}
