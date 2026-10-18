"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { useState } from "react"
import { marketingContent } from "@/content/marketing"

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div className="relative bg-slate-950 px-10 py-2 text-center text-xs text-slate-200">
      {marketingContent.announcement.text} <Link href={marketingContent.announcement.href} className="ml-1 font-semibold text-white underline underline-offset-4">{marketingContent.announcement.cta} →</Link>
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-300 hover:text-white focus-visible:outline-white" aria-label="Dismiss announcement" onClick={() => setVisible(false)}><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}
