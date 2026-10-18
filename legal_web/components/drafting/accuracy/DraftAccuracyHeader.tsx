"use client"

import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"
import { publicationStateLabel } from "@/lib/api/verification"

interface DraftAccuracyHeaderProps {
  verification: DraftVerificationAudit
  className?: string
}

export function DraftAccuracyHeader({ verification, className }: DraftAccuracyHeaderProps) {
  const t = useTranslations("drafting.accuracy")
  const canCertify = verification.canCertify === true
  const lawyerReady =
    verification.lawyerReady === true || verification.certificationLabel === "lawyer_ready"
  const label =
    verification.publicationState && !lawyerReady
      ? publicationStateLabel(verification.publicationState)
      : lawyerReady
        ? t("lawyerReady")
        : verification.certificationLabel === "complete_missing_facts"
          ? t("completeMissingFacts")
          : canCertify
            ? t("readyForLawyerReview")
            : verification.verificationStatus === "limited_sources"
              ? t("limitedCorpus")
              : t("needsReview")

  const meta = lawyerReady
    ? {
        icon: CheckCircle2,
        cls: "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700",
      }
    : canCertify
    ? {
        icon: CheckCircle2,
        cls: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
      }
    : verification.certificationLabel === "complete_missing_facts" ||
        verification.publicationState === "VERIFIED_WITH_LIMITATIONS"
      ? {
          icon: AlertTriangle,
          cls: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
        }
      : {
          icon: ShieldAlert,
          cls: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800",
        }

  const Icon = meta.icon
  const identityConfirmed = verification.dimensions?.identity.pass ?? verification.citationAudit?.verified ?? 0
  const citationTotal = verification.citationAudit?.total ?? verification.similarCases.length
  const passageSupported =
    (verification.propositions ?? []).filter((p) => p.supportState === "SUPPORTED").length

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        meta.cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{label}</span>
      {canCertify && (
        <span className="opacity-80">· {t("canCertifyShort")}</span>
      )}
      {citationTotal > 0 && (
        <span className="opacity-80">
          · {identityConfirmed}/{citationTotal} {t("citationsVerifiedShort")}
        </span>
      )}
      {passageSupported > 0 && (
        <span className="opacity-80">
          · {passageSupported} {t("passageSupportedShort")}
        </span>
      )}
      {verification.similarCases.length > 0 && (
        <span className="opacity-80">
          · {verification.similarCases.length} {t("similarCasesShort")}
        </span>
      )}
      {(verification.unresolvedFacts?.length ?? 0) > 0 && (
        <span className="opacity-80">
          · {verification.unresolvedFacts!.length} {t("factsPendingShort")}
        </span>
      )}
    </div>
  )
}
