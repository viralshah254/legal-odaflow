"use client"

import { useTranslations } from "next-intl"
import type { UrgencyLevel } from "@/lib/api/types"
import { resolvePracticeAreaSlug } from "@/lib/taxonomy/platform-taxonomy"
import enMessages from "../../messages/en.json"

const issueCheckerEn = enMessages.issueChecker

export const ISSUE_TYPE_KEYS = [
  "employment",
  "landlord",
  "family",
  "consumer",
  "contract",
  "contractDrafting",
  "debt",
  "criminal",
  "immigration",
  "other",
] as const

export type IssueTypeKey = (typeof ISSUE_TYPE_KEYS)[number]

/** Maps intake issue-type keys to canonical platform domain slugs. */
export const ISSUE_TYPE_TO_DOMAIN_SLUG: Record<IssueTypeKey, string> = {
  employment: "employment_labour",
  landlord: "real_estate_property",
  family: "family_matrimonial",
  consumer: "consumer",
  contract: "corporate_commercial",
  contractDrafting: "corporate_commercial",
  debt: "banking_finance",
  criminal: "litigation_disputes",
  immigration: "immigration",
  other: "general_usage",
}

export function issueTypeKeyToPracticeAreaSlug(key: IssueTypeKey): string {
  return ISSUE_TYPE_TO_DOMAIN_SLUG[key]
}

/** Resolve a classified issue type (label or key) to a canonical practice area slug. */
export function issueTypeToPracticeAreaSlug(issueType: string | undefined | null): string {
  if (!issueType?.trim()) return "general_usage"
  const key = resolveIssueTypeKey(issueType)
  if (key) return issueTypeKeyToPracticeAreaSlug(key)
  return resolvePracticeAreaSlug(issueType)
}

export function getIssueTypeEnglishLabel(key: IssueTypeKey): string {
  return issueCheckerEn.issueTypes[key]
}

export function resolveIssueTypeKey(issueType: string): IssueTypeKey | null {
  const match = ISSUE_TYPE_KEYS.find((key) => getIssueTypeEnglishLabel(key) === issueType)
  return match ?? null
}

export function useIssueCheckerLabels() {
  const t = useTranslations("issueChecker")

  const steps = [
    t("steps.story"),
    t("steps.details"),
    t("steps.documents"),
    t("steps.ready"),
  ] as const

  const issueTypes = ISSUE_TYPE_KEYS.map((key) => ({
    key,
    label: t(`issueTypes.${key}`),
    englishLabel: getIssueTypeEnglishLabel(key),
  }))

  const urgencyOptions = (
    [
      { value: "LOW" as UrgencyLevel, key: "low", shortKey: "lowShort", descKey: "lowDesc" },
      { value: "MEDIUM" as UrgencyLevel, key: "medium", shortKey: "mediumShort", descKey: "mediumDesc" },
      { value: "HIGH" as UrgencyLevel, key: "high", shortKey: "highShort", descKey: "highDesc" },
      { value: "URGENT" as UrgencyLevel, key: "urgent", shortKey: "urgentShort", descKey: "urgentDesc" },
    ] as const
  ).map(({ value, key, shortKey, descKey }) => ({
    value,
    label: t(`urgency.${key}`),
    short: t(`urgency.${shortKey}`),
    description: t(`urgency.${descKey}`),
  }))

  return {
    steps,
    stepCount: steps.length,
    issueTypes,
    urgencyOptions,
    getIssueTypeLabel: (issueType: string) => {
      const key = resolveIssueTypeKey(issueType)
      return key ? t(`issueTypes.${key}`) : issueType
    },
    issueTypeToPracticeAreaSlug,
    issueTypeKeyToPracticeAreaSlug,
    getUrgencyShort: (level: UrgencyLevel) => {
      const option = urgencyOptions.find((o) => o.value === level)
      return option?.short ?? level
    },
  }
}
