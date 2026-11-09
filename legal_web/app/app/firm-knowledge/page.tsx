"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useToast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api/client"
import { listMatters } from "@/lib/api/matters"
import { getFirmKnowledge, listFirmKnowledge, reviewFirmKnowledge, submitFirmKnowledge, type KnowledgeStatus } from "@/lib/api/firm-knowledge"

const statusKeys: Record<KnowledgeStatus, string> = {
  PENDING: "knowledge_status_pending", INDEXING: "knowledge_status_indexing", APPROVED: "knowledge_status_approved",
  INDEX_FAILED: "knowledge_status_index_failed", REJECTED: "knowledge_status_rejected", REVOKED: "knowledge_status_revoked",
}

export default function FirmKnowledgePage() {
  const t = useTranslations("common"), tAdmin = useTranslations("admin")
  const { activeTenantId } = useTenant()
  const { user } = useAuth()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [matterId, setMatterId] = useState("")
  const [documentId, setDocumentId] = useState("")
  const [matterSearch, setMatterSearch] = useState("")
  const [query, setQuery] = useState("")
  const [rightsBasis, setRightsBasis] = useState("FIRM_WORK_PRODUCT")
  const [expiry, setExpiry] = useState("")
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [selfReviewConfirmed, setSelfReviewConfirmed] = useState(false)
  const [firmWideConfirmed, setFirmWideConfirmed] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [formTenantId, setFormTenantId] = useState(activeTenantId)
  const currentTenant = useRef(activeTenantId)
  currentTenant.current = activeTenantId
  const source = useRef<{ id: string; type: string } | null>(null)

  useEffect(() => {
    source.current = null; setFormTenantId(activeTenantId); setSelectedId(""); setTitle(""); setContent(""); setMatterId(""); setDocumentId("");
    setRightsConfirmed(false); setSelfReviewConfirmed(false); setFirmWideConfirmed(false); setNote(""); setExpiry(""); setMatterSearch("")
  }, [activeTenantId])
  useEffect(() => { const timer = setTimeout(() => setQuery(matterSearch), 300); return () => clearTimeout(timer) }, [matterSearch])
  useEffect(() => { setSelfReviewConfirmed(false); setFirmWideConfirmed(false); setNote("") }, [selectedId])
  const { data, error, refetch } = useApiData(["firm-knowledge", activeTenantId], {
    apiFn: () => listFirmKnowledge(activeTenantId!), enabled: !!activeTenantId,
  })
  const { data: detail, error: detailError, isFetching, refetch: refetchDetail } = useApiData(["firm-knowledge-detail", activeTenantId, selectedId], {
    apiFn: () => getFirmKnowledge(activeTenantId!, selectedId), enabled: !!activeTenantId && !!selectedId, refetchInterval: 30_000,
  })
  const { data: matters = [] } = useApiData(["knowledge-matters", activeTenantId, query], {
    apiFn: () => listMatters(activeTenantId!, { search: query || undefined, limit: 50 }), enabled: !!activeTenantId,
  })
  const { data: documentOptions } = useApiData(["knowledge-documents", activeTenantId, matterId], {
    apiFn: () => apiFetch<{ documents: Array<{ id: string; fileName: string }> }>(`/ai/research/matter-context?matterId=${encodeURIComponent(matterId)}`, { tenantId: activeTenantId! }),
    enabled: !!activeTenantId && !!matterId,
  })
  const reset = () => { source.current = null; setTitle(""); setContent(""); setMatterId(""); setDocumentId(""); setExpiry(""); setRightsBasis("FIRM_WORK_PRODUCT"); setRightsConfirmed(false) }
  const submit = async () => {
    if (!activeTenantId || formTenantId !== activeTenantId || busy || !rightsConfirmed) return
    setBusy(true)
    try {
      source.current ??= { id: crypto.randomUUID(), type: "custom" }
      const saved = await submitFirmKnowledge(activeTenantId, { sourceId: source.current.id, sourceType: source.current.type,
        title: title.trim(), content: content.trim(), matterId: matterId || undefined, documentId: documentId || undefined,
        rightsBasis, rightsConfirmed, rightsExpiresAt: expiry ? new Date(expiry).toISOString() : undefined })
      if (currentTenant.current !== activeTenantId) return
      setSelectedId(saved.id); reset(); await refetch(); toast({ title: t("knowledge_saved") })
    } catch { toast({ title: t("knowledge_error"), variant: "destructive" }) }
    finally { setBusy(false) }
  }
  const review = async (decision: "approve" | "reject" | "revoke") => {
    if (!activeTenantId || !detail || detail.tenantId !== activeTenantId || detailError || busy || isFetching) return
    setBusy(true)
    try {
      await reviewFirmKnowledge(activeTenantId, detail, decision, { selfReviewConfirmed, firmWideConfirmed, note: note.trim() || undefined })
      if (currentTenant.current !== activeTenantId) return
      await Promise.all([refetch(), refetchDetail()]); toast({ title: t("knowledge_updated") })
    } catch { toast({ title: t("knowledge_error"), variant: "destructive" }) }
    finally { setBusy(false) }
  }
  const maker = detail?.lastEditedById === user?.id
  const reviewable = detail && ["PENDING", "INDEX_FAILED"].includes(detail.status)
  const canApprove = data?.canReview && reviewable && !detail?.rightsExpired && (!maker || (!data.independentReviewRequired && selfReviewConfirmed)) && (!!detail?.matterId || firmWideConfirmed)

  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <div><h1 className="text-2xl font-semibold">{t("knowledge_title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("knowledge_description")}</p></div>
    {error && <Button variant="outline" onClick={() => { void refetch() }}>{t("retry")}</Button>}
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{t("knowledge_new")}</CardTitle></CardHeader><CardContent className="space-y-4">
        {!data?.canSubmit && <p className="text-sm text-muted-foreground">{t("knowledge_read_only")}</p>}
        <div className="space-y-2"><Label htmlFor="knowledge-title">{t("title")}</Label><Input id="knowledge-title" value={title} maxLength={300} onChange={event => setTitle(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="knowledge-content">{t("knowledge_content")}</Label><Textarea id="knowledge-content" rows={8} maxLength={100000} value={content} onChange={event => setContent(event.target.value)} /></div>
        <div className="space-y-2"><Label>{t("calendar_linked_matter")}</Label>
          <Input aria-label={t("calendar_search_matters")} placeholder={t("calendar_search_matters")} value={matterSearch} onChange={event => setMatterSearch(event.target.value)} />
          <Select value={matterId || "none"} onValueChange={value => { setMatterId(value === "none" ? "" : value); setDocumentId("") }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="none">{tAdmin("none")}</SelectItem>
            {matterId && !matters.some(item => item.id === matterId) && <SelectItem value={matterId}>{t("calendar_linked_matter")}</SelectItem>}
            {matters.map(matter => <SelectItem key={matter.id} value={matter.id}>{matter.title}</SelectItem>)}
          </SelectContent></Select>
        </div>
        {matterId && <div className="space-y-2"><Label>{t("knowledge_source_document")}</Label><Select value={documentId || "none"} onValueChange={value => setDocumentId(value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="none">{tAdmin("none")}</SelectItem>
          {documentId && !documentOptions?.documents.some(document => document.id === documentId) && <SelectItem value={documentId}>{t("knowledge_source_document")}</SelectItem>}
          {documentOptions?.documents.map(document => <SelectItem key={document.id} value={document.id}>{document.fileName}</SelectItem>)}
        </SelectContent></Select></div>}
        <div className="space-y-2"><Label>{t("knowledge_rights")}</Label><Select value={rightsBasis} onValueChange={setRightsBasis}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="FIRM_WORK_PRODUCT">{t("knowledge_rights_firm")}</SelectItem><SelectItem value="LICENSED_INTERNAL_USE">{t("knowledge_rights_license")}</SelectItem><SelectItem value="PUBLIC_DOMAIN">{t("knowledge_rights_public")}</SelectItem>
        </SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="knowledge-expiry">{t("knowledge_expiry")}</Label><Input id="knowledge-expiry" type="datetime-local" value={expiry} onChange={event => setExpiry(event.target.value)} /></div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)} />{t("knowledge_rights_confirm")}</label>
        <div className="flex gap-2"><Button disabled={busy || formTenantId !== activeTenantId || !data?.canSubmit || !rightsConfirmed || !title.trim() || !content.trim()} onClick={() => { void submit() }}>{busy ? t("loading") : t("knowledge_submit")}</Button><Button variant="outline" disabled={busy} onClick={reset}>{t("knowledge_new")}</Button></div>
      </CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle>{t("knowledge_review")}</CardTitle><CardDescription>{t("knowledge_count", { count: data?.count ?? 0, limit: data?.limit ?? 100 })}</CardDescription></CardHeader><CardContent className="max-h-96 space-y-2 overflow-auto">
        {!data?.items.length && <p className="text-sm text-muted-foreground">{t("knowledge_empty")}</p>}
        {data?.items.map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted"><span>{item.title}</span><Badge variant="secondary">{t(item.rightsExpired ? "knowledge_expired" : statusKeys[item.status] ?? "knowledge_status_unknown")}</Badge></button>)}
      </CardContent></Card>
      {detail && !detailError && detail.tenantId === activeTenantId && <Card><CardHeader><CardTitle>{detail.title}</CardTitle><CardDescription>{t("knowledge_revision", { revision: detail.revision })}</CardDescription></CardHeader><CardContent className="space-y-4">
        {detail.rightsExpired && <p className="text-sm text-destructive">{t("knowledge_expired")}</p>}
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm font-sans">{detail.content}</pre>
        {data?.canSubmit && <Button variant="outline" disabled={busy || isFetching} onClick={() => { source.current = { id: detail.sourceId, type: detail.sourceType }; setTitle(detail.title); setContent(detail.content); setMatterId(detail.matterId || ""); setDocumentId(detail.documentId || ""); setRightsBasis(detail.rightsBasis); setExpiry(detail.rightsExpiresAt ? format(new Date(detail.rightsExpiresAt), "yyyy-MM-dd'T'HH:mm") : ""); setRightsConfirmed(false) }}>{t("knowledge_revise")}</Button>}
        {data?.canReview && reviewable && <>
          {maker && data.independentReviewRequired && <p className="text-sm text-muted-foreground">{t("knowledge_independent_review")}</p>}
          {maker && !data.independentReviewRequired && <label className="flex gap-2 text-sm"><input type="checkbox" checked={selfReviewConfirmed} onChange={event => setSelfReviewConfirmed(event.target.checked)} />{t("knowledge_self_review_confirm")}</label>}
          {!detail.matterId && <label className="flex gap-2 text-sm"><input type="checkbox" checked={firmWideConfirmed} onChange={event => setFirmWideConfirmed(event.target.checked)} />{t("knowledge_firm_wide_confirm")}</label>}
          <Textarea aria-label={t("knowledge_review_note")} placeholder={t("knowledge_review_note")} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
          <div className="flex gap-2"><Button disabled={busy || isFetching || !canApprove} onClick={() => { void review("approve") }}>{t("knowledge_approve")}</Button><Button variant="outline" disabled={busy || isFetching} onClick={() => { void review("reject") }}>{t("knowledge_reject")}</Button></div>
        </>}
        {(data?.canReview || detail.createdById === user?.id) && detail.status !== "REVOKED" && <Button variant="destructive" disabled={busy || isFetching} onClick={() => { void review("revoke") }}>{t("knowledge_revoke")}</Button>}
        {!!detail.reviews.length && <div className="space-y-2"><h2 className="font-medium">{t("knowledge_review_history")}</h2>{detail.reviews.map(record => <div key={record.id} className="rounded border p-2 text-sm"><span>{t("knowledge_revision", { revision: record.revision })} · {new Date(record.createdAt).toLocaleString()} · {t(record.decision === "APPROVE" ? "knowledge_status_approved" : record.decision === "REJECT" ? "knowledge_status_rejected" : "knowledge_status_revoked")}</span>{record.note && <p className="mt-1 whitespace-pre-wrap">{record.note}</p>}</div>)}</div>}
      </CardContent></Card>}
      </div>
    </div>
  </div>
}
