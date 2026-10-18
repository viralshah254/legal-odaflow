"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ActionCard {
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  iconColor: string
  iconBg: string
  ringColor: string
  glowColor: string
  cardGradient: string
  borderColor: string
}

export const ACTION_STAGGER = [
  "animate-slide-up-d0",
  "animate-slide-up-d1",
  "animate-slide-up-d2",
  "animate-slide-up-d3",
  "animate-slide-up-d4",
  "animate-slide-up-d5",
  "animate-slide-up-d6",
  "animate-slide-up-d7",
  "animate-slide-up-d8",
]

export function ActionTiltCard({ action, index }: { action: ActionCard; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const Icon = action.icon

  const onMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    el.style.setProperty("--mouse-x", `${x}px`)
    el.style.setProperty("--mouse-y", `${y}px`)
    const rx = ((y / rect.height) - 0.5) * -12
    const ry = ((x / rect.width) - 0.5) * 12
    el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`
  }

  const onMouseLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transition = "transform 0.55s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.4s ease"
    el.style.transform = ""
    setTimeout(() => {
      if (ref.current) ref.current.style.transition = ""
    }, 600)
  }

  return (
    <Link
      ref={ref}
      href={action.href}
      className={cn(
        "spotlight-card group relative flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-5",
        "will-change-transform overflow-hidden min-h-[132px]",
        action.cardGradient,
        action.borderColor,
        ACTION_STAGGER[index] ?? "animate-slide-up-d4",
      )}
      style={{ "--glow-color": action.glowColor } as React.CSSProperties}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <span className="spotlight-overlay pointer-events-none absolute inset-0 rounded-2xl" />

      <div className="flex items-start justify-between">
        <div className={cn("relative rounded-xl p-2.5", action.iconBg)}>
          <span className={cn("icon-ring absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100", action.ringColor)} />
          <Icon className={cn("relative z-10 h-5 w-5 transition-transform duration-300 group-hover:scale-110", action.iconColor)} />
        </div>
        {action.badge ? (
          <span className="text-[15px] leading-none drop-shadow-sm">{action.badge}</span>
        ) : null}
      </div>

      <div className="flex-1">
        <p className="text-[13px] font-semibold leading-snug text-foreground">{action.label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{action.description}</p>
      </div>

      <ArrowRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-muted-foreground/25 transition-all duration-300 group-hover:text-muted-foreground/70 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
    </Link>
  )
}
