import { cn } from "@/lib/utils"
import {
  AI_CITATION_NOTICE,
  AI_OUTPUT_DISCLAIMER,
  ATTORNEY_DISCLAIMER,
  STANDARD_DISCLAIMER,
} from "@/lib/legal/disclaimers"

export {
  STANDARD_DISCLAIMER as UNIVERSAL_LEGAL_DISCLAIMER,
  AI_CITATION_NOTICE,
  ATTORNEY_DISCLAIMER,
} from "@/lib/legal/disclaimers"

interface LegalDisclaimerProps {
  variant?: "compact" | "default"
  disclaimerVariant?: "consumer" | "attorney" | "ai"
  showCitationNotice?: boolean
  className?: string
  children?: React.ReactNode
}

export function LegalDisclaimer({
  variant = "default",
  disclaimerVariant = "consumer",
  showCitationNotice = false,
  className,
  children,
}: LegalDisclaimerProps) {
  const text =
    children ??
    (disclaimerVariant === "attorney"
      ? ATTORNEY_DISCLAIMER
      : disclaimerVariant === "ai"
        ? AI_OUTPUT_DISCLAIMER
        : STANDARD_DISCLAIMER)

  return (
    <p
      className={cn(
        "text-muted-foreground",
        variant === "compact" ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
        className,
      )}
    >
      {text}
      {showCitationNotice && <> {AI_CITATION_NOTICE}</>}
    </p>
  )
}
