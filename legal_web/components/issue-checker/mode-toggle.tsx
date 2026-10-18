"use client"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import type { IssueCheckerMode } from "./constants"
import { Briefcase, User } from "lucide-react"

interface ModeToggleProps {
  mode: IssueCheckerMode
  onChange: (mode: IssueCheckerMode) => void
  showFirmIntake?: boolean
}

export function ModeToggle({ mode, onChange, showFirmIntake = true }: ModeToggleProps) {
  const t = useTranslations("issueChecker")
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange("SELF")}
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
          mode === "SELF"
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border hover:bg-muted/50",
        )}
      >
        <User className="h-5 w-5 mt-0.5 text-primary shrink-0" />
        <div>
          <p className="font-medium">{t("personal_legal_check")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("personalCheckDescription")}</p>
        </div>
      </button>
      {showFirmIntake && (
        <button
          type="button"
          onClick={() => onChange("FIRM_INTAKE")}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
            mode === "FIRM_INTAKE"
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border hover:bg-muted/50",
          )}
        >
          <Briefcase className="h-5 w-5 mt-0.5 text-primary shrink-0" />
          <div>
            <p className="font-medium">{t("client_matter_intake")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("route_to_your_firm_workspace_with_ai_support")}</p>
          </div>
        </button>
      )}
    </div>
  )
}
