"use client"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles } from "lucide-react"
import type { IssueCheckerMode, IssueCheckerWizardData } from "./constants"
import { useIssueCheckerLabels } from "@/lib/i18n/use-issue-checker-labels"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StoryStepProps {
  mode: IssueCheckerMode
  data: IssueCheckerWizardData
  classifying: boolean
  onChange: (partial: Partial<IssueCheckerWizardData>) => void
}

export function StoryStep({ mode, data, classifying, onChange }: StoryStepProps) {
  const t = useTranslations("issueChecker")
  const { issueTypes, getIssueTypeLabel } = useIssueCheckerLabels()
  const defaultIssueType = issueTypes[issueTypes.length - 1]?.englishLabel ?? "Other"

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="facts" className="text-base">
          {mode === "FIRM_INTAKE" ? t("storyTitleFirm") : t("storyTitlePersonal")}
        </Label>
        <p className="text-sm text-muted-foreground mt-1">{t("storyDescription")}</p>
      </div>

      {mode === "FIRM_INTAKE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientName">{t("client_name")}</Label>
            <Input
              id="clientName"
              placeholder={t("eg_jane_smith")}
              value={data.clientName}
              onChange={(e) => onChange({ clientName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientReference">{t("matter_reference_optional")}</Label>
            <Input
              id="clientReference"
              placeholder={t("eg_js-2026-001")}
              value={data.clientReference}
              onChange={(e) => onChange({ clientReference: e.target.value })}
            />
          </div>
        </div>
      )}

      <Textarea
        id="facts"
        rows={8}
        placeholder={mode === "FIRM_INTAKE" ? t("storyPlaceholderFirm") : t("storyPlaceholderPersonal")}
        value={data.facts}
        onChange={(e) => onChange({ facts: e.target.value })}
      />

      {(classifying || data.issueType) && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {classifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("analyzingSituation")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-primary" />
                {t("classifiedAs")}
              </>
            )}
          </div>
          {!classifying && data.issueType && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getIssueTypeLabel(data.issueType)}</Badge>
              {data.title && (
                <span className="text-sm text-muted-foreground">{data.title}</span>
              )}
            </div>
          )}
          {!classifying && (
            <div className="space-y-2">
              <Label htmlFor="issueTypeOverride" className="text-xs text-muted-foreground">
                {t("adjustCategory")}
              </Label>
              <Select
                value={data.issueType || defaultIssueType}
                onValueChange={(value) => onChange({ issueType: value })}
              >
                <SelectTrigger id="issueTypeOverride" className="h-9">
                  <SelectValue placeholder={t("issue_type")} />
                </SelectTrigger>
                <SelectContent>
                  {issueTypes.map(({ key, label, englishLabel }) => (
                    <SelectItem key={key} value={englishLabel}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
