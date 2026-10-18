"use client"

import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { ReferralsPanel } from "@/components/referrals/referrals-panel"

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <CinematicNavbar />
      <ReferralsPanel variant="marketing" />
    </div>
  )
}
