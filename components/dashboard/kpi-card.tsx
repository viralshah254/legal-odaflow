import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  delta?: {
    value: number
    label?: string
    positive?: boolean
  }
  className?: string
}

export function KpiCard({ icon: Icon, label, value, delta, className }: KpiCardProps) {
  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {delta && (
              <p
                className={cn(
                  "text-xs font-medium mt-2",
                  delta.positive !== false ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {delta.positive !== false ? "+" : ""}
                {delta.value}% {delta.label || "vs last month"}
              </p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

