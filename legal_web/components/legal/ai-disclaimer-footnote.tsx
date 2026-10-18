"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

interface AiDisclaimerFootnoteProps {
  className?: string
}

/** Small persistent AI disclaimer shown at the bottom of authenticated app pages. */
export function AiDisclaimerFootnote({ className }: AiDisclaimerFootnoteProps) {
  const t = useTranslations("legal")
  const tCommon = useTranslations("common")

  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/50 bg-[hsl(var(--surface))]/90 px-4 sm:px-6 py-2.5",
        className,
      )}
    >
      <p className="mx-auto max-w-[1600px] text-[11px] leading-relaxed text-muted-foreground/75">
        {t("aiOutputDisclaimer")}{" "}
        <Link
          href="/legal-disclaimer"
          className="whitespace-nowrap underline underline-offset-2 hover:text-muted-foreground"
        >
          {tCommon("learnMore")}
        </Link>
      </p>
    </footer>
  )
}
