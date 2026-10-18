"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import {
  getMatterCourtCase,
  createMatterCourtCase,
  listCourtHearings,
  addCourtHearing,
  listCourtFilings,
  addCourtFiling,
  listDocketEntries,
  addDocketEntry,
  lookupECourts,
  syncUsDocket,
  type CourtCase,
  type CourtHearing,
  type CourtFiling,
  type DocketEntry,
} from "@/lib/api/matter-court"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Gavel, Plus, Loader2, AlertCircle, RefreshCw, Scale } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

const HEARING_TYPES = ["First Hearing", "Evidence Hearing", "Arguments", "Order", "Judgment", "Adjournment", "Other"]
const FILING_TYPES = ["Plaint", "Written Statement", "Reply", "Counter Claim", "Petition", "Application", "Appeal", "Affidavit", "Exhibit", "Other"]

export default function CourtPage() {
  const t = useTranslations("matters")
  const tAdmin = useTranslations("admin")
  const tCommon = useTranslations("common")
  const tBilling = useTranslations("billing")
  const tErr = useTranslations("errors")
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [linkForm, setLinkForm] = useState({ caseNumber: "", cnrNumber: "", jurisdiction: "India", court: "", judge: "", filingDate: "", notes: "" })
  const [linking, setLinking] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [addHearingOpen, setAddHearingOpen] = useState(false)
  const [addFilingOpen, setAddFilingOpen] = useState(false)
  const [addDocketOpen, setAddDocketOpen] = useState(false)
  const [hearingForm, setHearingForm] = useState({ hearingDate: "", hearingType: "First Hearing", description: "", outcome: "", nextDate: "" })
  const [filingForm, setFilingForm] = useState({ filingDate: "", filingType: "Plaint", description: "", status: "Filed" })
  const [docketForm, setDocketForm] = useState({ entryDate: "", entryType: "Order", description: "" })
  const [saving, setSaving] = useState(false)
  const [syncingDocket, setSyncingDocket] = useState(false)
  const [docketProvider, setDocketProvider] = useState<string | null>(null)

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-court-matter", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: courtCase, isLoading: caseLoading } = useApiData<CourtCase | null>(
    ["court-case", activeTenantId, matterId],
    {
      apiFn: () => getMatterCourtCase(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: hearings = [], isLoading: hearingsLoading } = useApiData<CourtHearing[]>(
    ["court-hearings", activeTenantId, courtCase?.id],
    {
      apiFn: () => listCourtHearings(activeTenantId!, courtCase!.id),
      enabled: !!activeTenantId && !!courtCase?.id,
    },
  )

  const { data: filings = [], isLoading: filingsLoading } = useApiData<CourtFiling[]>(
    ["court-filings", activeTenantId, courtCase?.id],
    {
      apiFn: () => listCourtFilings(activeTenantId!, courtCase!.id),
      enabled: !!activeTenantId && !!courtCase?.id,
    },
  )

  const { data: docketEntries = [], isLoading: docketLoading } = useApiData<DocketEntry[]>(
    ["court-docket", activeTenantId, courtCase?.id],
    {
      apiFn: () => listDocketEntries(activeTenantId!, courtCase!.id),
      enabled: !!activeTenantId && !!courtCase?.id,
    },
  )

  const handleLinkCase = async () => {
    if (!activeTenantId) return
    setLinking(true)
    try {
      await createMatterCourtCase(activeTenantId, matterId, {
        caseNumber: linkForm.caseNumber || undefined,
        cnrNumber: linkForm.cnrNumber || undefined,
        jurisdiction: linkForm.jurisdiction || undefined,
        court: linkForm.court || undefined,
        judge: linkForm.judge || undefined,
        filingDate: linkForm.filingDate || undefined,
        notes: linkForm.notes || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ["court-case", activeTenantId, matterId] })
      toast({ title: tErr("toast.courtCaseLinked") })
    } catch {
      toast({ title: tErr("toast.failedToLinkCourtCase"), variant: "destructive" })
    } finally {
      setLinking(false)
    }
  }

  const handleECourtsLookup = async () => {
    if (!activeTenantId || !linkForm.cnrNumber) {
      toast({ title: tErr("toast.enterCnrFirst"), variant: "destructive" })
      return
    }
    setLookingUp(true)
    try {
      const result = await lookupECourts(activeTenantId, linkForm.cnrNumber, {
        matterId,
      }) as Record<string, unknown>
      if (result.court) setLinkForm((f) => ({ ...f, court: result.court as string }))
      if (result.judge) setLinkForm((f) => ({ ...f, judge: result.judge as string }))
      const provider = String(result.provider ?? "")
      const isStub = provider.includes("stub")
      toast({
        title: isStub ? "Development eCourts data loaded" : tErr("toast.eCourtsDataFetched"),
        description: isStub
          ? String(result.disclaimer ?? "This is stub data — configure ECOURTS_API_URL for live lookups.")
          : provider
            ? `Provider: ${provider}`
            : undefined,
        variant: isStub ? "default" : "default",
      })
    } catch {
      toast({ title: tErr("toast.eCourtsLookupFailed"), variant: "destructive" })
    } finally {
      setLookingUp(false)
    }
  }

  const handleUsDocketSync = async () => {
    if (!activeTenantId || !courtCase) return
    setSyncingDocket(true)
    try {
      const result = await syncUsDocket(activeTenantId, { matterId, courtCaseId: courtCase.id })
      setDocketProvider(result.provider ?? "courtlistener")
      queryClient.invalidateQueries({ queryKey: ["court-docket", activeTenantId, courtCase.id] })
      toast({
        title: tErr("toast.docketSynced"),
        description: `${result.syncedEntries} entries synced`,
      })
    } catch {
      toast({ title: tErr("toast.docketSyncFailed"), variant: "destructive" })
    } finally {
      setSyncingDocket(false)
    }
  }

  const handleAddHearing = async () => {
    if (!activeTenantId || !courtCase) return
    setSaving(true)
    try {
      await addCourtHearing(activeTenantId, courtCase.id, {
        hearingDate: hearingForm.hearingDate,
        hearingType: hearingForm.hearingType || undefined,
        description: hearingForm.description || undefined,
        outcome: hearingForm.outcome || undefined,
        nextDate: hearingForm.nextDate || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ["court-hearings", activeTenantId, courtCase.id] })
      setAddHearingOpen(false)
      setHearingForm({ hearingDate: "", hearingType: "First Hearing", description: "", outcome: "", nextDate: "" })
      toast({ title: tErr("toast.hearingAdded") })
    } catch {
      toast({ title: tErr("toast.failedToAddHearing"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleAddFiling = async () => {
    if (!activeTenantId || !courtCase) return
    setSaving(true)
    try {
      await addCourtFiling(activeTenantId, courtCase.id, {
        filingDate: filingForm.filingDate,
        filingType: filingForm.filingType,
        description: filingForm.description || undefined,
        status: filingForm.status || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ["court-filings", activeTenantId, courtCase.id] })
      setAddFilingOpen(false)
      setFilingForm({ filingDate: "", filingType: "Plaint", description: "", status: "Filed" })
      toast({ title: tErr("toast.filingAdded") })
    } catch {
      toast({ title: tErr("toast.failedToAddFiling"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleAddDocket = async () => {
    if (!activeTenantId || !courtCase) return
    setSaving(true)
    try {
      await addDocketEntry(activeTenantId, courtCase.id, {
        entryDate: docketForm.entryDate,
        entryType: docketForm.entryType,
        description: docketForm.description,
      })
      queryClient.invalidateQueries({ queryKey: ["court-docket", activeTenantId, courtCase.id] })
      setAddDocketOpen(false)
      setDocketForm({ entryDate: "", entryType: "Order", description: "" })
      toast({ title: tErr("toast.docketEntryAdded") })
    } catch {
      toast({ title: tErr("toast.failedToAddEntry"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (matterLoading || !matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId!} showIntelligenceSidebar={false}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h2 className="text-xl font-bold">{t("court_amp_litigation")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t("track_hearings_filings_and_docket_entries")}</p>
        </div>

        {caseLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !courtCase ? (
          /* Link court case form */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-muted-foreground" />
                Link a court case
              </CardTitle>
              <CardDescription>{t("connect_this_matter_to_a_court_case_to_track_proceedings")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("cnr_number_india")}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={linkForm.cnrNumber}
                      onChange={(e) => setLinkForm((f) => ({ ...f, cnrNumber: e.target.value }))}
                      placeholder={t("eg_dlhc01-123456-2024")}
                    />
                    <Button variant="outline" size="sm" onClick={handleECourtsLookup} disabled={lookingUp} className="shrink-0">
                      {lookingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("click_refresh_to_auto-fill_from_ecourts")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("case_number_docket")}</Label>
                  <Input
                    value={linkForm.caseNumber}
                    onChange={(e) => setLinkForm((f) => ({ ...f, caseNumber: e.target.value }))}
                    placeholder={t("eg_csos_1232024")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tAdmin("jurisdiction")}</Label>
                  <Select value={linkForm.jurisdiction} onValueChange={(v) => setLinkForm((f) => ({ ...f, jurisdiction: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="India">{tCommon("india")}</SelectItem>
                      <SelectItem value="US">{tCommon("united_states")}</SelectItem>
                      <SelectItem value="UK">{tCommon("united_kingdom")}</SelectItem>
                      <SelectItem value="Kenya">{tCommon("kenya")}</SelectItem>
                      <SelectItem value="UAE">{t("uae")}</SelectItem>
                      <SelectItem value="Other">{tCommon("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("court_tribunal")}</Label>
                  <Input
                    value={linkForm.court}
                    onChange={(e) => setLinkForm((f) => ({ ...f, court: e.target.value }))}
                    placeholder={t("eg_delhi_high_court")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("judge_bench")}</Label>
                  <Input
                    value={linkForm.judge}
                    onChange={(e) => setLinkForm((f) => ({ ...f, judge: e.target.value }))}
                    placeholder={t("eg_hon_justice_rk_sharma")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("filing_date")}</Label>
                  <Input
                    type="date"
                    value={linkForm.filingDate}
                    onChange={(e) => setLinkForm((f) => ({ ...f, filingDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("notes")}</Label>
                <Textarea
                  value={linkForm.notes}
                  onChange={(e) => setLinkForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("any_additional_notes_about_this_court_case")}
                  className="resize-none"
                />
              </div>
              <Button onClick={handleLinkCase} disabled={linking || (!linkForm.caseNumber && !linkForm.cnrNumber)} className="gap-2">
                {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                Link court case
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Court case linked — show tabs */
          <div className="space-y-4">
            {/* Case summary card */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {courtCase.caseNumber && (
                      <div><span className="text-muted-foreground">{t("case")}</span><span className="font-mono font-medium">{courtCase.caseNumber}</span></div>
                    )}
                    {courtCase.cnrNumber && (
                      <div><span className="text-muted-foreground">{t("cnr")}</span><span className="font-mono font-medium">{courtCase.cnrNumber}</span></div>
                    )}
                    {courtCase.court && (
                      <div><span className="text-muted-foreground">{t("court")}</span><span className="font-medium">{courtCase.court}</span></div>
                    )}
                    {courtCase.judge && (
                      <div><span className="text-muted-foreground">{t("judge")}</span><span>{courtCase.judge}</span></div>
                    )}
                    {courtCase.jurisdiction && (
                      <Badge variant="secondary">{courtCase.jurisdiction}</Badge>
                    )}
                    {docketProvider && (
                      <Badge variant="outline">Docket: {docketProvider}</Badge>
                    )}
                  </div>
                  {(courtCase.jurisdiction === "US" || courtCase.jurisdiction === "United States") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUsDocketSync}
                      disabled={syncingDocket}
                      className="gap-1.5"
                    >
                      {syncingDocket ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Sync US docket
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="hearings">
              <TabsList className="w-full overflow-x-auto justify-start h-auto flex-nowrap gap-1">
                <TabsTrigger value="hearings" className="shrink-0 whitespace-nowrap">Hearings ({hearings.length})</TabsTrigger>
                <TabsTrigger value="filings" className="shrink-0 whitespace-nowrap">Filings ({filings.length})</TabsTrigger>
                <TabsTrigger value="docket" className="shrink-0 whitespace-nowrap">Docket ({docketEntries.length})</TabsTrigger>
              </TabsList>

              {/* Hearings */}
              <TabsContent value="hearings" className="space-y-3 mt-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAddHearingOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add hearing
                  </Button>
                </div>
                {hearingsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : hearings.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No hearings recorded yet. Add the first hearing date.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tBilling("date")}</TableHead>
                          <TableHead>{tAdmin("type")}</TableHead>
                          <TableHead>{tBilling("description")}</TableHead>
                          <TableHead>{t("outcome")}</TableHead>
                          <TableHead>{t("next_date")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hearings.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-mono text-xs">{format(new Date(h.hearingDate), "dd MMM yyyy")}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{h.hearingType}</Badge></TableCell>
                            <TableCell className="text-sm max-w-xs truncate">{h.description ?? "—"}</TableCell>
                            <TableCell className="text-sm">{h.outcome ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{h.nextDate ? format(new Date(h.nextDate), "dd MMM yyyy") : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Filings */}
              <TabsContent value="filings" className="space-y-3 mt-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAddFilingOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add filing
                  </Button>
                </div>
                {filingsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : filings.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No filings recorded yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tBilling("date")}</TableHead>
                          <TableHead>{tAdmin("type")}</TableHead>
                          <TableHead>{tBilling("description")}</TableHead>
                          <TableHead>{tAdmin("status")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filings.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-mono text-xs">{format(new Date(f.filingDate), "dd MMM yyyy")}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{f.filingType}</Badge></TableCell>
                            <TableCell className="text-sm max-w-xs truncate">{f.description ?? "—"}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{f.status ?? "—"}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Docket */}
              <TabsContent value="docket" className="space-y-3 mt-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAddDocketOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add entry
                  </Button>
                </div>
                {docketLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : docketEntries.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No docket entries yet.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tBilling("date")}</TableHead>
                          <TableHead>{tAdmin("type")}</TableHead>
                          <TableHead>{tBilling("description")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docketEntries.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{format(new Date(d.entryDate), "dd MMM yyyy")}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{d.entryType}</Badge></TableCell>
                            <TableCell className="text-sm">{d.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Add hearing sheet */}
      <Sheet open={addHearingOpen} onOpenChange={setAddHearingOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{t("add_hearing")}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("date_2")}</Label>
              <Input type="date" value={hearingForm.hearingDate} onChange={(e) => setHearingForm((f) => ({ ...f, hearingDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("type")}</Label>
              <Select value={hearingForm.hearingType} onValueChange={(v) => setHearingForm((f) => ({ ...f, hearingType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HEARING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tBilling("description")}</Label>
              <Textarea value={hearingForm.description} onChange={(e) => setHearingForm((f) => ({ ...f, description: e.target.value }))} className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label>{t("outcome")}</Label>
              <Input value={hearingForm.outcome} onChange={(e) => setHearingForm((f) => ({ ...f, outcome: e.target.value }))} placeholder={t("eg_adjourned_to_next_date")} />
            </div>
            <div className="space-y-2">
              <Label>{t("next_hearing_date")}</Label>
              <Input type="date" value={hearingForm.nextDate} onChange={(e) => setHearingForm((f) => ({ ...f, nextDate: e.target.value }))} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleAddHearing} disabled={saving || !hearingForm.hearingDate} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add hearing
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add filing sheet */}
      <Sheet open={addFilingOpen} onOpenChange={setAddFilingOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{t("add_filing")}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("filing_date_2")}</Label>
              <Input type="date" value={filingForm.filingDate} onChange={(e) => setFilingForm((f) => ({ ...f, filingDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("filing_type")}</Label>
              <Select value={filingForm.filingType} onValueChange={(v) => setFilingForm((f) => ({ ...f, filingType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FILING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tBilling("description")}</Label>
              <Textarea value={filingForm.description} onChange={(e) => setFilingForm((f) => ({ ...f, description: e.target.value }))} className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label>{tAdmin("status")}</Label>
              <Select value={filingForm.status} onValueChange={(v) => setFilingForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Filed", "Pending", "Accepted", "Rejected", "Withdrawn"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleAddFiling} disabled={saving || !filingForm.filingDate} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add filing
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add docket sheet */}
      <Sheet open={addDocketOpen} onOpenChange={setAddDocketOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{t("add_docket_entry")}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("date_2")}</Label>
              <Input type="date" value={docketForm.entryDate} onChange={(e) => setDocketForm((f) => ({ ...f, entryDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("type_2")}</Label>
              <Select value={docketForm.entryType} onValueChange={(v) => setDocketForm((f) => ({ ...f, entryType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Order", "Notice", "Summons", "Judgment", "Decree", "Stay", "Injunction", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tBilling("description_2")}</Label>
              <Textarea value={docketForm.description} onChange={(e) => setDocketForm((f) => ({ ...f, description: e.target.value }))} className="resize-none" placeholder={t("brief_description_of_this_docket_entry")} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleAddDocket} disabled={saving || !docketForm.entryDate || !docketForm.description} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add entry
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </MatterWorkspaceShell>
  )
}
