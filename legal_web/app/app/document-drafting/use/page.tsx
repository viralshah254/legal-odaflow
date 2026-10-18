"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { createDraftingSession } from "@/lib/api/drafting-session"
import { UseTemplateWizard } from "@/components/document-drafting/use-template-wizard"

const KENYA_INITIAL_DRAFTS = [
  { documentKind: "civil_plaint", label: "Civil Plaint" },
  { documentKind: "notice_of_motion", label: "Notice of Motion" },
  { documentKind: "supporting_affidavit", label: "Supporting Affidavit" },
  { documentKind: "employment_claim", label: "Memorandum of Claim" },
  { documentKind: "demand_letter", label: "Demand Letter" },
] as const

function UseTemplatePageInner() {
  const t = useTranslations("drafting")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const { setContext } = useCopilotContext()

  const templateId = searchParams.get("templateId") ?? undefined
  const systemTemplate = searchParams.get("systemTemplate") === "true"
  const query = searchParams.get("query") ?? ""
  const documentKind = searchParams.get("documentKind") ?? undefined
  const countryCode = searchParams.get("countryCode") ?? undefined
  const isKenyaCatalog = countryCode === "KE" && documentKind === "kenya_form_catalog"

  const [sessionId, setSessionId] = useState<string | null>(searchParams.get("sessionId"))
  const [loading, setLoading] = useState(!sessionId)
  const [error, setError] = useState<string | null>(null)

  const resolvedTemplateId = useMemo(() => {
    if (systemTemplate) return undefined
    return templateId
  }, [systemTemplate, templateId])

  useEffect(() => {
    setContext({
      page: "document-drafting-studio",
      draftQuery: query,
      documentKind,
      intent: "DOCUMENT_DRAFT",
    })
  }, [setContext, query, documentKind])

  useEffect(() => {
    if (sessionId || !activeTenantId) return
    if (isKenyaCatalog) {
      setLoading(false)
      return
    }
    const supportsConfiguredTemplateRouting = countryCode === "KE" && Boolean(documentKind)
    if (!resolvedTemplateId && !systemTemplate && !supportsConfiguredTemplateRouting) {
      setError(t("errors.missingTemplate"))
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const session = await createDraftingSession(activeTenantId, {
          templateId: resolvedTemplateId,
          systemTemplateId: systemTemplate ? templateId : undefined,
          documentKind,
          countryCode,
          sourceQuery: query || undefined,
        })
        if (cancelled) return
        setSessionId(session.id)
        router.replace(
          `/app/document-drafting/use?sessionId=${session.id}`,
          { scroll: false },
        )
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("errors.createFailed"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    activeTenantId,
    sessionId,
    resolvedTemplateId,
    systemTemplate,
    templateId,
    documentKind,
    countryCode,
    isKenyaCatalog,
    query,
    router,
    t,
  ])

  if (!activeTenantId) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link
          href="/app/legal-forms"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.backToForms")}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{t("use.title")}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t("use.subtitle")}</p>

      {isKenyaCatalog && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Kenya drafting catalog</h2>
            <p className="text-sm text-muted-foreground">
              Select an initial Kenya document. These templates are pending advocate review and
              require current-law and filing-requirement verification.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {KENYA_INITIAL_DRAFTS.map((draft) => {
              const params = new URLSearchParams({
                countryCode: "KE",
                documentKind: draft.documentKind,
                query,
              })
              return (
                <Link
                  key={draft.documentKind}
                  href={`/app/document-drafting/use?${params.toString()}`}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="font-medium">{draft.label}</div>
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Advocate review pending
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-36 rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {sessionId && activeTenantId && !loading && (
        <UseTemplateWizard tenantId={activeTenantId} sessionId={sessionId} />
      )}
    </div>
  )
}

export default function DocumentDraftingUsePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <UseTemplatePageInner />
    </Suspense>
  )
}
