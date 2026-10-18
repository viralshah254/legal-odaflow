"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getMatter } from "@/lib/api/matters"
import { listTenantUsers } from "@/lib/api/users"
import { createAssistanceRequest } from "@/lib/api/assistance"
import { addTimelineEvent } from "@/lib/api/timeline"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  AssistanceType,
  AssistanceAccessScope,
  getAssistanceTypeLabel,
  getAccessScopeLabel,
} from "@/lib/types/assistance"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Loader2 } from "lucide-react"

interface RequestAssistanceDialogProps {
  matterId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestComplete: () => void
}

export function RequestAssistanceDialog({
  matterId,
  open,
  onOpenChange,
  onRequestComplete,
}: RequestAssistanceDialogProps) {
  const t = useTranslations("matters")
  const tCommon = useTranslations("common")
  const { currentUser, currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const user = currentUser ?? { id: "", name: "User", email: "" }
  const [helperIds, setHelperIds] = useState<string[]>([])
  const [assistanceType, setAssistanceType] = useState<AssistanceType>("DRAFTING")
  const [accessScope, setAccessScope] = useState<AssistanceAccessScope>("MATTER_CLIENT_DOCS")
  const [dueDate, setDueDate] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  const { data: matter } = useApiData(
    ["matter-assistance", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && open,
    },
  )

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users-assistance", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId && open,
    },
  )

  if (!matter) return null

  const availableHelpers = tenantUsers.filter(
    (tu) =>
      tu.userId !== user.id &&
      (currentRole === "PARTNER_ADMIN" || tu.role !== "FIRM_ADMIN"),
  )

  const toggleHelper = (userId: string) => {
    setHelperIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleSubmit = async () => {
    if (helperIds.length === 0 || !user.id || !activeTenantId) return

    const helperNames = tenantUsers
      .filter((tu) => helperIds.includes(tu.userId))
      .map((tu) => tu.user.name ?? tu.user.email)

    setSubmitting(true)
    try {
      for (const helperId of helperIds) {
        await createAssistanceRequest(activeTenantId, {
          matterId,
          scope: accessScope,
          reason: notes || `${assistanceType}: ${getAssistanceTypeLabel(assistanceType)}`,
          assignedToId: helperId,
        })
      }

      await addTimelineEvent(activeTenantId, {
        matterId,
        type: "ASSISTANCE_GRANTED",
        title: t("assistance_requested"),
        description: `${user.name} requested assistance from ${helperNames.join(", ")}`,
        metadata: {
          helperIds,
          helperNames,
          assistanceType,
          accessScope,
          dueDate: dueDate || undefined,
        },
      })

      onRequestComplete()
      onOpenChange(false)
      setHelperIds([])
      setAssistanceType("DRAFTING")
      setAccessScope("MATTER_CLIENT_DOCS")
      setDueDate("")
      setNotes("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("request_assistance")}</DialogTitle>
          <DialogDescription>
            {t("request_assistance_description", { title: matter.title })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("select_helpers")}</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {availableHelpers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("no_available_helpers")}
                </p>
              ) : (
                availableHelpers.map((tu) => (
                  <div key={tu.userId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`helper-${tu.userId}`}
                      checked={helperIds.includes(tu.userId)}
                      onCheckedChange={() => toggleHelper(tu.userId)}
                    />
                    <Label
                      htmlFor={`helper-${tu.userId}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2 flex-1"
                    >
                      <Users className="h-4 w-4" />
                      {tu.user.name ?? tu.user.email} ({tu.role})
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistance-type">{t("assistance_type")}</Label>
            <Select
              value={assistanceType}
              onValueChange={(value) => setAssistanceType(value as AssistanceType)}
            >
              <SelectTrigger id="assistance-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "LEGAL_RESEARCH",
                    "DRAFTING",
                    "FILING",
                    "CLIENT_COMMUNICATION",
                    "NEGOTIATION",
                    "OTHER",
                  ] as AssistanceType[]
                ).map((type) => (
                  <SelectItem key={type} value={type}>
                    {getAssistanceTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("access_scope")}</Label>
            <RadioGroup
              value={accessScope}
              onValueChange={(value: string) =>
                setAccessScope(value as AssistanceAccessScope)
              }
            >
              {(
                ["MATTER_ONLY", "MATTER_CLIENT_DOCS", "FULL_CASE_SUPPORT"] as AssistanceAccessScope[]
              ).map((scope) => (
                <div key={scope} className="flex items-center space-x-2">
                  <RadioGroupItem value={scope} id={scope} />
                  <Label htmlFor={scope} className="text-sm font-normal cursor-pointer">
                    {getAccessScopeLabel(scope)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">{t("due_date_optional")}</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea
              id="notes"
              placeholder={t("additional_details_about_the_assistance_needed")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={helperIds.length === 0 || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("request_assistance")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
