"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listMatters, getMatter } from "@/lib/api/matters"
import { createEvidence, listEvidence, type EvidenceItem } from "@/lib/api/series-a"
import { EvidenceWorkspace } from "@/components/evidence/evidence-workspace"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { format } from "date-fns"
import { FileArchive, Gavel, Loader2, Plus, ShieldAlert, ShieldCheck, Users } from "lucide-react"

export default function EvidenceVaultPage() {
  const t = useTranslations("lawyer")
  const tBilling = useTranslations("billing")
  const tCommon = useTranslations("common")
  const tAdmin = useTranslations("admin")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [selectedMatterId, setSelectedMatterId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [newItem, setNewItem] = useState({ title: "", description: "" })

  const { data: matters = [], isLoading: mattersLoading } = useApiData(
    ["evidence-vault-matters", activeTenantId],
    {
      apiFn: () => listMatters(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const activeMatterId = selectedMatterId || matters[0]?.id || ""

  const {
    data: evidence = [],
    isLoading: evidenceLoading,
    error: evidenceError,
    refetch,
  } = useApiData<EvidenceItem[]>(
    ["evidence-vault", activeTenantId, activeMatterId],
    {
      apiFn: () => listEvidence(activeTenantId!, activeMatterId),
      enabled: !!activeTenantId && !!activeMatterId,
    },
  )

  const { data: activeMatter } = useApiData(
    ["evidence-matter-mi", activeTenantId, activeMatterId],
    {
      apiFn: () => getMatter(activeTenantId!, activeMatterId),
      enabled: !!activeTenantId && !!activeMatterId,
    },
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return evidence
    return evidence.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q),
    )
  }, [evidence, searchQuery])

  const selectedMatter = matters.find((m) => m.id === activeMatterId)

  const readinessCards = [
    { label: "Chronology", value: filtered.length, helper: "Evidence items ordered by date", icon: Gavel },
    { label: "Exhibits", value: filtered.length, helper: "Ready for bundle review", icon: FileArchive },
    { label: "Witness / party map", value: activeMatterId ? "Matter linked" : "Select matter", helper: "Tie evidence to people", icon: Users },
    { label: "Privilege review", value: "Required", helper: "Flag sensitive items before export", icon: ShieldAlert },
  ]

  const handleCreate = async () => {
    if (!activeTenantId || !activeMatterId || !newItem.title.trim()) return
    setCreating(true)
    setCreateError("")
    try {
      await createEvidence(activeTenantId, activeMatterId, {
        title: newItem.title.trim(),
        description: newItem.description.trim() || undefined,
      })
      setNewItem({ title: "", description: "" })
      setDialogOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ["evidence-vault", activeTenantId, activeMatterId],
      })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create evidence item")
    } finally {
      setCreating(false)
    }
  }

  if (mattersLoading) {
    return <PageSkeleton rows={8} />
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "ASSOCIATE", "PARALEGAL", "JUNIOR_PARTNER"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-7 w-7" />
              Evidence vault
            </h1>
            <p className="text-muted-foreground mt-1">
              Chain-of-custody evidence items linked to matters
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} disabled={!activeMatterId}>
            <Plus className="h-4 w-4 mr-2" />
            Add evidence
          </Button>
        </div>

        {matters.length === 0 ? (
          <EmptyState
            title={t("no_matters_yet")}
            description={t("create_matter_before_adding_evidence")}
            actionLabel="Go to matters"
            actionHref="/app/matters"
          />
        ) : (
          <>
            <Card data-tour="evidence-matter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("filter")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tBilling("matter")}</Label>
                  <Select value={activeMatterId} onValueChange={setSelectedMatterId}>
                    <SelectTrigger>
                      <SelectValue placeholder={tCommon("select_matter")} />
                    </SelectTrigger>
                    <SelectContent>
                      {matters.map((matter) => (
                        <SelectItem key={matter.id} value={matter.id}>
                          {matter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tCommon("search")}</Label>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("search_by_title_or_description")}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {readinessCards.map(({ label, value, helper, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="text-lg font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{helper}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeMatterId && (
              <EvidenceWorkspace
                matterId={activeMatterId}
                matterGraph={activeMatter?.matterGraph ?? undefined}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedMatter ? selectedMatter.title : "Evidence items"}
                </CardTitle>
                <CardDescription>
                  {filtered.length} item{filtered.length === 1 ? "" : "s"} with custody logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {evidenceError ? (
                  <ErrorState
                    message={
                      evidenceError instanceof Error
                        ? evidenceError.message
                        : "Failed to load evidence"
                    }
                    onRetry={() => refetch()}
                  />
                ) : evidenceLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    title={tCommon("no_evidence_items")}
                    description={t("add_evidence_to_track_chain_of_custody_for_matter")}
                    actionLabel="Add evidence"
                    onAction={() => setDialogOpen(true)}
                  />
                ) : (
                  <Table data-tour="evidence-list">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tAdmin("title_2")}</TableHead>
                        <TableHead>{tBilling("description")}</TableHead>
                        <TableHead>{t("custody_events")}</TableHead>
                        <TableHead>{t("created")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {item.description ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.custodyLogs?.length ?? 0} events
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(item.createdAt), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("add_evidence_item")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evidence-title">{tAdmin("title_2")}</Label>
                <Input
                  id="evidence-title"
                  value={newItem.title}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evidence-description">{tBilling("description")}</Label>
                <Input
                  id="evidence-description"
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
              {createError && <p className="text-destructive text-sm">{createError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating || !newItem.title.trim()}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
