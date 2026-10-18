"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Check, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordHasNumber,
  type PasswordPolicyContext,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy"

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  context?: PasswordPolicyContext
  showStrength?: boolean
  autoComplete?: string
  placeholder?: string
}

const STRENGTH_COLORS: Record<string, string> = {
  veryWeak: "bg-destructive",
  weak: "bg-orange-500",
  fair: "bg-yellow-500",
  strong: "bg-lime-500",
  veryStrong: "bg-emerald-500",
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  context,
  showStrength = true,
  autoComplete = "new-password",
  placeholder,
}: PasswordFieldProps) {
  const t = useTranslations("auth")
  const [visible, setVisible] = useState(false)

  const analysis = useMemo(
    () => (value ? validatePasswordPolicy(value, context) : null),
    [value, context],
  )

  const meetsLength = value.length >= PASSWORD_MIN_LENGTH
  const meetsNumber = passwordHasNumber(value)
  const strengthPercent = analysis ? ((analysis.score + 1) / 5) * 100 : 0

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          maxLength={PASSWORD_MAX_LENGTH}
          placeholder={placeholder ?? t("passwordPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help ${id}-strength`}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value.length > 0 && analysis && (
        <div id={`${id}-strength`} className="space-y-1.5" aria-live="polite">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full transition-all duration-200", STRENGTH_COLORS[analysis.label])}
              style={{ width: `${strengthPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("passwordStrength")}: {t(`passwordStrength_${analysis.label}`)}
          </p>
        </div>
      )}

      <div id={`${id}-help`} className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("passwordGuidance")}</p>
        <ul className="space-y-0.5" aria-label={t("passwordGuidance")}>
          <li
            className={cn(
              "flex items-center gap-1.5 text-xs",
              meetsLength ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            <Check className={cn("h-3.5 w-3.5", !meetsLength && "opacity-30")} aria-hidden />
            {t("passwordRequirementMinLength", { min: PASSWORD_MIN_LENGTH })}
          </li>
          <li
            className={cn(
              "flex items-center gap-1.5 text-xs",
              meetsNumber ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            <Check className={cn("h-3.5 w-3.5", !meetsNumber && "opacity-30")} aria-hidden />
            {t("passwordRequirementNumber")}
          </li>
        </ul>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
