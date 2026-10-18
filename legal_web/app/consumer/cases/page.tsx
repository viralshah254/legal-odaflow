"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { listCases } from "@/lib/api/consumers"
import { useAuth } from "@/lib/contexts/auth-context"
import { formatDate } from "@/lib/utils"
import { ArrowRight, Plus } from "lucide-react"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function ConsumerCasesPage() {
  const t = useTranslations("consumer")
  const { isAuthenticated } = useAuth()
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["consumer-cases"],
    queryFn: listCases,
    enabled: isAuthenticated,
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("nav.cases")}</h1>
            <p className="text-muted-foreground">{t("all_your_saved_legal_issue_checks")}</p>
          </div>
          <Link href="/legal-issue-checker">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Case
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("cases_2")}</CardTitle>
            <CardDescription>{cases.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PageSkeleton rows={4} />
            ) : cases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No cases found.{" "}
                <Link href="/legal-issue-checker" className="text-primary hover:underline">
                  Start an issue check
                </Link>
              </p>
            ) : (
              <div className="divide-y" data-tour="consumer-case-list">
                {cases.map((c) => (
                  <Link
                    key={c.id}
                    href={`/consumer/cases/${c.id}`}
                    className="flex items-center justify-between py-4 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.countryCode} · {c.issueType} · Updated {formatDate(c.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{c.status}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
