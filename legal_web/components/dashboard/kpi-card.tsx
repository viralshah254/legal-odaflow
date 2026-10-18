"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type KpiVariant = "default" | "success" | "warning" | "danger"

interface KpiCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  delta?: {
    value: number
    label?: string
    positive?: boolean
  }
  variant?: KpiVariant
  className?: string
  /** Compact pill mode for the mobile horizontal-scroll strip */
  compact?: boolean
}

const variantStyles: Record<KpiVariant, { icon: string; delta: string; glow: string }> = {
  default: {
    icon: "bg-primary/10 dark:bg-primary/20 text-primary",
    delta: "",
    glow: "hover:shadow-primary/10",
  },
  success: {
    icon: "bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400",
    delta: "",
    glow: "hover:shadow-green-500/10",
  },
  warning: {
    icon: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
    delta: "",
    glow: "hover:shadow-amber-500/10",
  },
  danger: {
    icon: "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400",
    delta: "",
    glow: "hover:shadow-red-500/10",
  },
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) {
      setCount(0)
      return
    }
    startRef.current = null
    const step = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const progress = Math.min((timestamp - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return count
}

export function KpiCard({ icon: Icon, label, value, delta, variant = "default", className, compact }: KpiCardProps) {
  const tk = useTranslations("dashboard.kpi")
  const styles = variantStyles[variant]
  const isNumeric = typeof value === "number"
  const animated = useCountUp(isNumeric ? (value as number) : 0)
  const displayValue = isNumeric ? animated : value

  const deltaPositive = delta ? (delta.positive !== false) : false

  if (compact) {
    return (
      <Card
        className={cn(
          "overflow-hidden relative shrink-0 min-w-[110px] snap-start",
          "transition-all duration-300",
          className,
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-0.5 rounded-t-xl opacity-60",
            variant === "default" && "bg-gradient-to-r from-primary/60 to-primary/20",
            variant === "success" && "bg-gradient-to-r from-green-500/60 to-green-500/20",
            variant === "warning" && "bg-gradient-to-r from-amber-500/60 to-amber-500/20",
            variant === "danger" && "bg-gradient-to-r from-red-500/60 to-red-500/20",
          )}
        />
        <CardContent className="p-3">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", styles.icon)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <p className="text-2xl font-extrabold text-foreground stat-counter leading-none">{displayValue}</p>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 leading-tight">{label}</p>
          {delta && (
            <span
              className={cn(
                "inline-block mt-1.5 text-[10px] font-semibold px-1 py-0.5 rounded-full",
                deltaPositive
                  ? "text-green-700 dark:text-green-400 bg-green-500/10"
                  : "text-red-700 dark:text-red-400 bg-red-500/10",
              )}
            >
              {deltaPositive ? "↑" : "↓"} {Math.abs(delta.value)}%
            </span>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "card-glow overflow-hidden relative",
        "transition-all duration-300",
        className
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-0.5 rounded-t-xl opacity-60",
          variant === "default" && "bg-gradient-to-r from-primary/60 to-primary/20",
          variant === "success" && "bg-gradient-to-r from-green-500/60 to-green-500/20",
          variant === "warning" && "bg-gradient-to-r from-amber-500/60 to-amber-500/20",
          variant === "danger" && "bg-gradient-to-r from-red-500/60 to-red-500/20",
        )}
      />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5 leading-tight">
              {label}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground stat-counter leading-none">
              {displayValue}
            </p>
            {delta && (
              <div className="flex items-center gap-1 mt-1.5 sm:mt-2 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded-full",
                    deltaPositive
                      ? "text-green-700 dark:text-green-400 bg-green-500/10"
                      : "text-red-700 dark:text-red-400 bg-red-500/10",
                  )}
                >
                  {deltaPositive ? "↑" : "↓"} {Math.abs(delta.value)}%
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {delta.label ?? tk("vsLastMonth")}
                </span>
              </div>
            )}
          </div>
          <div className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0", styles.icon)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
