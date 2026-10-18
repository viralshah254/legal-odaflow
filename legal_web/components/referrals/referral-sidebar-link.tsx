"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gift } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsSubscribed } from "@/lib/hooks/use-is-subscribed"

export function ReferralSidebarLink() {
  const t = useTranslations("common")
  const pathname = usePathname()
  const { isSubscribed, isLoading } = useIsSubscribed()

  const isActive =
    pathname === "/app/referrals" ||
    pathname.startsWith("/app/referrals/") ||
    pathname === "/referrals"

  if (isLoading || !isSubscribed) return null

  return (
    <div className="pt-3 mt-1 border-t border-border/60">
      <Link
        href="/app/referrals"
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 overflow-hidden relative",
          isActive
            ? "bg-primary text-primary-foreground shadow-[0_2px_8px_0_hsl(var(--primary)/0.35)]"
            : "text-muted-foreground hover:bg-[hsl(var(--muted)/0.7)] hover:text-foreground",
        )}
      >
        <Gift className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "")} />
        <span className="flex flex-col min-w-0">
          <span className="truncate">{t("refer_earn_2")}</span>
          <span className={cn("text-[10px] font-normal leading-tight truncate", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {t("referral_sidebar_subtitle")}
          </span>
        </span>
      </Link>
    </div>
  )
}
