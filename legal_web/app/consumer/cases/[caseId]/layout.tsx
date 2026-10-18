"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { PageEnter } from "@/components/ui/motion"
import { getCase } from "@/lib/api/consumers"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"

const TAB_KEYS = [
  { href: "", labelKey: "nav.home" as const },
  { href: "/report", labelKey: "preview" as const },
  { href: "/documents", labelKey: "nav.documents" as const },
  { href: "/drafts", labelKey: "drafts" as const },
  { href: "/messages", labelKey: "messages" as const },
  { href: "/payments", labelKey: "pay" as const },
  { href: "/consent", labelKey: "data_ai_consent" as const },
] as const

const FOCUS_SUFFIXES = ["/report", "/lawyer-review"] as const

export default function ConsumerCaseLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { caseId: string }
}) {
  const pathname = usePathname()
  const t = useTranslations("consumer")
  const { isAuthenticated } = useAuth()
  const base = `/consumer/cases/${params.caseId}`

  const isFocusRoute = FOCUS_SUFFIXES.some(
    (suffix) => pathname === `${base}${suffix}` || pathname.startsWith(`${base}${suffix}/`),
  )

  const { data: caseData, isLoading, error, refetch } = useApiData(
    ["consumer-case", params.caseId],
    {
      apiFn: () => getCase(params.caseId),
      enabled: isAuthenticated,
    },
  )

  return (
    <div className="min-h-screen bg-background">
      <PageEnter
        className={cn(
          "mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full",
          isFocusRoute ? "max-w-4xl" : "max-w-5xl",
        )}
      >
        <Link href="/consumer/cases">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back_to_dashboard")}
          </Button>
        </Link>

        {isLoading && <PageSkeleton rows={4} />}
        {error && (
          <ErrorState
            message={t("unableToLoadCase")}
            onRetry={() => void refetch()}
          />
        )}

        {caseData && (
          <>
            {isFocusRoute ? (
              <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={base}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← {t("view_case")}
                </Link>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium truncate max-w-[min(100%,20rem)]">
                  {caseData.title}
                </span>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{caseData.status}</Badge>
                    <Badge variant="outline">{caseData.countryCode}</Badge>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{caseData.title}</h1>
                  <p className="text-muted-foreground mt-1">
                    {caseData.issueType} · {t("created_datestr", { dateStr: formatDate(caseData.createdAt) })}
                  </p>
                </div>

                <nav
                  className="flex flex-wrap gap-1 mb-6 p-1 rounded-lg bg-muted/50 border border-border/50"
                  aria-label={t("case_workspace_tabs")}
                  data-tour="consumer-case-tabs"
                >
                  {TAB_KEYS.map((tab) => {
                    const href = `${base}${tab.href}`
                    const active =
                      tab.href === ""
                        ? pathname === base
                        : tab.href === "/report"
                          ? pathname === href || pathname.startsWith(`${href}/`)
                          : pathname.startsWith(href)
                    return (
                      <Link
                        key={tab.labelKey}
                        href={href}
                        className={cn(
                          "px-3 py-2 text-sm font-medium rounded-md transition-colors duration-normal",
                          active
                            ? "bg-background text-foreground shadow-token-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t(tab.labelKey)}
                      </Link>
                    )
                  })}
                </nav>
              </>
            )}

            {children}
          </>
        )}
      </PageEnter>
    </div>
  )
}
