import { AlertCircle, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

interface ClientProfileAlertProps {
  missingFields: string[]
  onEdit: () => void
  onDismiss: () => void
}

export function ClientProfileAlert({
  missingFields,
  onEdit,
  onDismiss,
}: ClientProfileAlertProps) {
  const t = useTranslations("clients")

  if (!missingFields.length) return null

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2 sm:items-center">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 sm:mt-0" aria-hidden="true" />
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {t("completeProfileFields", { fields: missingFields.join(", ") })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          {t("edit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDismiss}
          aria-label={t("profileIncompleteDismiss")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
