"use client"

import { useMemo, useState } from "react"
import { Check, FilePlus2, Loader2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  attachMatterForms,
  fetchLegalForms,
  listMatterFormAttachments,
  type JurisdictionForm,
} from "@/lib/api/legal-forms"
import { useApiData } from "@/lib/hooks/use-api-data"

export function MatterFormRecommendations({
  tenantId,
  matterId,
  practiceArea,
  countryCode,
  jurisdiction,
  matterType,
}: {
  tenantId: string
  matterId: string
  practiceArea?: string | null
  countryCode?: string | null
  jurisdiction?: string | null
  matterType?: string | null
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)

  const {
    data: forms = [],
    isLoading,
  } = useApiData<JurisdictionForm[]>(
    ["matter-form-recommendations", countryCode, practiceArea, jurisdiction, matterType],
    {
      apiFn: async () => {
        const query = {
          countryCode: countryCode ?? undefined,
          practiceArea: practiceArea ?? undefined,
          jurisdiction: jurisdiction ?? undefined,
        }
        const matterTypeMatches = matterType
          ? await fetchLegalForms({ ...query, matterType })
          : []
        return matterTypeMatches.length > 0
          ? matterTypeMatches
          : fetchLegalForms(query)
      },
      enabled: Boolean(countryCode && practiceArea),
    },
  )
  const {
    data: attachments = [],
    refetch: refetchAttachments,
  } = useApiData(
    ["matter-form-attachments", tenantId, matterId],
    {
      apiFn: () => listMatterFormAttachments(tenantId, matterId),
      enabled: Boolean(tenantId && matterId),
    },
  )
  const attachedIds = useMemo(
    () => new Set(attachments.map((attachment) => attachment.formId)),
    [attachments],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matching = query
      ? forms.filter((form) =>
          [form.formName, form.formNumber, form.authority, form.category, form.description]
            .some((value) => value?.toLowerCase().includes(query)))
      : forms
    return [...matching].sort((a, b) => {
      const type = matterType?.toLowerCase()
      const score = (form: JurisdictionForm) =>
        type && [form.category, form.formName, form.description]
          .some((value) => value?.toLowerCase().includes(type)) ? 1 : 0
      return score(b) - score(a) || a.formName.localeCompare(b.formName)
    })
  }, [forms, matterType, search])
  const visible = expanded || search ? filtered : filtered.slice(0, 5)

  async function attach(formId: string) {
    setAttachingId(formId)
    try {
      await attachMatterForms(tenantId, matterId, [formId])
      await refetchAttachments()
      toast({ title: "Form attached to matter" })
    } catch {
      toast({ title: "Could not attach form", variant: "destructive" })
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FilePlus2 className="h-4 w-4 text-primary" />
          Recommended forms
        </CardTitle>
        <CardDescription>
          {matterType ? `${matterType} forms` : "Forms"} for {jurisdiction || countryCode || "this jurisdiction"}.
          Attach only what this matter needs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search forms by name, authority, or number"
            className="pl-9"
          />
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding relevant forms…
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No matching forms were found. Try a broader search.
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((form) => {
              const attached = attachedIds.has(form.id)
              return (
                <div key={form.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{form.formName}</p>
                      {form.formNumber && <Badge variant="outline">{form.formNumber}</Badge>}
                      {form.category && <Badge variant="secondary">{form.category}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{form.authority}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={attached ? "outline" : "default"}
                    disabled={attached || attachingId === form.id}
                    onClick={() => void attach(form.id)}
                  >
                    {attachingId === form.id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : attached
                        ? <Check className="mr-2 h-4 w-4" />
                        : <FilePlus2 className="mr-2 h-4 w-4" />}
                    {attached ? "Attached" : "Attach"}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        {!search && filtered.length > 5 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Show recommended only" : `Browse all ${filtered.length} forms`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
