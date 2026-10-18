import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatePanelProps {
  title: string
  description?: string
  icon?: LucideIcon
  variant?: "default" | "success" | "loading"
  className?: string
}

export function StatePanel({
  title,
  description,
  icon: Icon,
  variant = "default",
  className,
}: StatePanelProps) {
  const ResolvedIcon = Icon ?? (variant === "success" ? CheckCircle2 : Loader2)
  const isLoading = variant === "loading"

  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4",
        variant === "success" && "border-green-500/30 bg-green-500/5",
        variant === "loading" && "border-border/60 bg-muted/20",
        variant === "default" && "border-border/60 bg-card",
        className,
      )}
      role={variant === "loading" ? "status" : "note"}
      aria-busy={isLoading}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-muted p-2">
          <ResolvedIcon
            className={cn(
              "h-4 w-4 text-muted-foreground",
              variant === "success" && "text-green-600 dark:text-green-400",
              isLoading && "animate-spin",
            )}
          />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
