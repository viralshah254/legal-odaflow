"use client"
import { useTranslations } from "next-intl"

import { useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import {
  listMatterParties,
  createMatterParty,
  updateMatterParty,
  deleteMatterParty,
  PARTY_ROLES,
  type MatterParty,
} from "@/lib/api/matter-parties"
import { sendCopilotMessage } from "@/lib/api/copilot"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Plus, Edit2, Trash2, Users, Sparkles, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const ROLE_GROUP_ORDER = ["CLIENT", "OPPOSING_PARTY", "OPPOSING_COUNSEL", "WITNESS", "EXPERT", "JUDGE", "INSURER", "GUARANTOR", "THIRD_PARTY", "OTHER"]

function getRoleLabel(role: string): string {
  return PARTY_ROLES.find((r) => r.value === role)?.label ?? role
}

function getRoleVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  if (role === "CLIENT") return "default"
  if (role === "OPPOSING_PARTY" || role === "OPPOSING_COUNSEL") return "destructive"
  return "secondary"
}

type PartyFormState = {
  name: string
  role: string
  organization: string
  email: string
  phone: string
}

const emptyForm: PartyFormState = { name: "", role: "OPPOSING_PARTY", organization: "", email: "", phone: "" }

export default function PartiesPage() {
  const tBilling = useTranslations("billing")
  const t = useTranslations("matters")
  const tErr = useTranslations("errors")
  const tAdmin = useTranslations("admin")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [addOpen, setAddOpen] = useState(false)
  const [editParty, setEditParty] = useState<MatterParty | null>(null)
  const [form, setForm] = useState<PartyFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteParty, setDeleteParty] = useState<MatterParty | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null)

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-parties-matter", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: parties = [], isLoading: partiesLoading, error } = useApiData<MatterParty[]>(
    ["matter-parties", activeTenantId, matterId],
    {
      apiFn: () => listMatterParties(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  // Group parties by role
  const grouped = ROLE_GROUP_ORDER.reduce<Record<string, MatterParty[]>>((acc, role) => {
    const inRole = parties.filter((p) => p.role === role)
    if (inRole.length > 0) acc[role] = inRole
    return acc
  }, {})

  const openAdd = () => {
    setForm(emptyForm)
    setAddOpen(true)
  }

  const openEdit = (party: MatterParty) => {
    setEditParty(party)
    setForm({
      name: party.name,
      role: party.role,
      organization: party.organization ?? "",
      email: party.email ?? "",
      phone: party.phone ?? "",
    })
  }

  const handleSave = async () => {
    if (!activeTenantId || !form.name) return
    setSaving(true)
    try {
      if (editParty) {
        await updateMatterParty(activeTenantId, matterId, editParty.id, {
          name: form.name,
          role: form.role,
          organization: form.organization || null,
          email: form.email || null,
          phone: form.phone || null,
        })
        toast({ title: tErr("toast.partyUpdated") })
        setEditParty(null)
      } else {
        await createMatterParty(activeTenantId, matterId, {
          name: form.name,
          role: form.role,
          organization: form.organization || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
        })
        toast({ title: tErr("toast.partyAdded") })
        setAddOpen(false)
      }
      queryClient.invalidateQueries({ queryKey: ["matter-parties", activeTenantId, matterId] })
    } catch {
      toast({ title: tErr("toast.failedToSaveParty"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeTenantId || !deleteParty) return
    setDeleting(true)
    try {
      await deleteMatterParty(activeTenantId, matterId, deleteParty.id)
      queryClient.invalidateQueries({ queryKey: ["matter-parties", activeTenantId, matterId] })
      toast({ title: tErr("toast.partyRemoved") })
    } catch {
      toast({ title: tErr("toast.failedToRemoveParty"), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteParty(null)
    }
  }

  const handleAISuggest = useCallback(async () => {
    if (!activeTenantId || !matter) return
    setAiSuggesting(true)
    setAiSuggestions(null)
    try {
      const existing = parties.map((p) => `${p.name} (${getRoleLabel(p.role)})`).join(", ")
      const res = await sendCopilotMessage(activeTenantId, {
        message: `Based on this matter: "${matter.title}" (${matter.practiceArea ?? "General"}, ${matter.factsSummary ?? "No summary"}), the current parties are: ${existing || "None yet"}. Who else should be added as parties? List specific roles and why they are relevant to this type of case.`,
        context: { matterId, clientId: matter.clientId, selectedMatterId: matterId },
      })
      setAiSuggestions(res.message.content)
    } catch {
      toast({ title: tErr("toast.aiSuggestionFailed"), variant: "destructive" })
    } finally {
      setAiSuggesting(false)
    }
  }, [activeTenantId, matter, parties, matterId, toast])

  if (matterLoading || !matter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const PartyForm = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>{tBilling("name_2")}</Label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("full_name_or_organization_name")} autoFocus />
      </div>
      <div className="space-y-2">
        <Label>{t("role")}</Label>
        <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARTY_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("organization")}</Label>
        <Input value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} placeholder={t("company_firm_name_optional")} />
      </div>
      <div className="space-y-2">
        <Label>{tAdmin("email")}</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder={t("contactexamplecom")} />
      </div>
      <div className="space-y-2">
        <Label>{tAuth("phone")}</Label>
        <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t("1_555_123_4567")} />
      </div>
    </div>
  )

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId!} showIntelligenceSidebar={false}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{t("parties")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("everyone_involved_in_this_matter_clients_opposing_parties_wi")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAISuggest} disabled={aiSuggesting} className="gap-1.5">
              {aiSuggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI suggest
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add party
            </Button>
          </div>
        </div>

        {/* AI suggestions */}
        {aiSuggestions && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{aiSuggestions}</CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">{t("failed_to_load_parties")}</p>
              <Button variant="outline" size="sm" className="mt-3"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["matter-parties", activeTenantId, matterId] })}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {partiesLoading && !error && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!partiesLoading && !error && parties.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-4">
              <Users className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium text-lg">{t("no_parties_added_yet")}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Start by adding the opposing party. You can also ask AI to suggest who should be involved based on the matter type.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={openAdd} className="gap-2">
                  <Plus className="h-4 w-4" /> Add opposing party
                </Button>
                <Button variant="outline" onClick={handleAISuggest} disabled={aiSuggesting} className="gap-2">
                  {aiSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Ask AI
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grouped party list */}
        {Object.entries(grouped).map(([role, roleParties]) => (
          <div key={role}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <Badge variant={getRoleVariant(role)} className="text-xs">{getRoleLabel(role)}</Badge>
              <span className="text-muted-foreground font-normal">({roleParties.length})</span>
            </h3>
            <div className="space-y-2">
              {roleParties.map((party) => (
                <Card key={party.id} className="group">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{party.name}</span>
                          {party.organization && (
                            <span className="text-xs text-muted-foreground">· {party.organization}</span>
                          )}
                        </div>
                        {(party.email || party.phone) && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                            {party.email && <span>{party.email}</span>}
                            {party.phone && <span>{party.phone}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(party)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteParty(party)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add party sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{t("add_party")}</SheetTitle></SheetHeader>
          <PartyForm />
          <SheetFooter>
            <Button onClick={handleSave} disabled={saving || !form.name} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add party
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit party sheet */}
      <Sheet open={!!editParty} onOpenChange={(o) => !o && setEditParty(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{t("edit_party")}</SheetTitle></SheetHeader>
          <PartyForm />
          <SheetFooter>
            <Button onClick={handleSave} disabled={saving || !form.name} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteParty} onOpenChange={(o) => !o && setDeleteParty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("remove_party")}</DialogTitle>
            <DialogDescription>Remove {deleteParty?.name} from this matter. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteParty(null)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MatterWorkspaceShell>
  )
}
