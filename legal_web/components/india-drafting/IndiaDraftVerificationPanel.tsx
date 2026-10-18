"use client"

import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { DraftAccuracyPanel } from "@/components/drafting/accuracy/DraftAccuracyPanel"

/** @deprecated Use DraftAccuracyPanel */
export function IndiaDraftVerificationPanel({
  verification,
  className,
}: {
  verification: DraftVerificationAudit | null | undefined
  className?: string
}) {
  return <DraftAccuracyPanel verification={verification} className={className} />
}
