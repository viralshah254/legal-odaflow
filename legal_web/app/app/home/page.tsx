"use client"

import { useRef } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  Search,
  FileText,
  Table2,
  BookOpen,
  PenLine,
  UserPlus,
  CalendarDays,
  Users,
  LayoutDashboard,
  ArrowRight,
  Zap,
} from "lucide-react"
import { useRole } from "@/lib/contexts/role-context"
import { cn } from "@/lib/utils"

interface ActionCard {
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

const actions: ActionCard[] = [
  {
    label: "Document Drafting",
    description: "AI drafting and official form catalog",
    href: "/app/legal-forms",
    icon: PenLine,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/15",
    ringColor: "bg-violet-400/20",
    glowColor: "rgba(139,92,246,0.28)",
    cardGradient: "from-violet-500/[0.07] to-violet-600/[0.02]",
    borderColor: "border-violet-500/20 hover:border-violet-400/50",
  },
  {
    label: "Document Review",
    description: "Analyse and annotate documents",
    href: "/app/document-review",
    icon: FileText,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/15",
    ringColor: "bg-violet-400/20",
    glowColor: "rgba(139,92,246,0.28)",
    cardGradient: "from-violet-500/[0.07] to-violet-600/[0.02]",
    borderColor: "border-violet-500/20 hover:border-violet-400/50",
  },
  {
    label: "Tabular Review",
    description: "Side-by-side clause comparison",
    href: "/app/document-review?mode=tabular",
    icon: Table2,
    iconColor: "text-indigo-400",
    iconBg: "bg-indigo-500/15",
    ringColor: "bg-indigo-400/20",
    glowColor: "rgba(99,102,241,0.28)",
    cardGradient: "from-indigo-500/[0.07] to-indigo-600/[0.02]",
    borderColor: "border-indigo-500/20 hover:border-indigo-400/50",
  },
  {
    label: "Legal Research",
    description: "Search case law and statutes",
    href: "/app/research",
    icon: Search,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/15",
    ringColor: "bg-blue-400/20",
    glowColor: "rgba(59,130,246,0.28)",
    cardGradient: "from-blue-500/[0.07] to-blue-600/[0.02]",
    borderColor: "border-blue-500/20 hover:border-blue-400/50",
  },
  {
    label: "New Intake",
    description: "Register a new client or lead",
    href: "/app/intake",
    icon: UserPlus,
    iconColor: "text-teal-400",
    iconBg: "bg-teal-500/15",
    ringColor: "bg-teal-400/20",
    glowColor: "rgba(20,184,166,0.28)",
    cardGradient: "from-teal-500/[0.07] to-teal-600/[0.02]",
    borderColor: "border-teal-500/20 hover:border-teal-400/50",
  },
  {
    label: "Leads",
    description: "Manage your pipeline",
    href: "/app/leads",
    icon: Users,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15",
    ringColor: "bg-amber-400/20",
    glowColor: "rgba(245,158,11,0.28)",
    cardGradient: "from-amber-500/[0.07] to-amber-600/[0.02]",
    borderColor: "border-amber-500/20 hover:border-amber-400/50",
  },
  {
    label: "Calendar",
    description: "View hearings and appointments",
    href: "/app/calendar",
    icon: CalendarDays,
    iconColor: "text-sky-400",
    iconBg: "bg-sky-500/15",
    ringColor: "bg-sky-400/20",
    glowColor: "rgba(14,165,233,0.28)",
    cardGradient: "from-sky-500/[0.07] to-sky-600/[0.02]",
    borderColor: "border-sky-500/20 hover:border-sky-400/50",
  },
  {
    label: "Section Finder",
    description: "Find applicable IPC / CrPC sections",
    href: "/app/section-finder",
    icon: BookOpen,
    badge: "🇮🇳",
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/15",
    ringColor: "bg-orange-400/20",
    glowColor: "rgba(249,115,22,0.28)",
    cardGradient: "from-orange-500/[0.07] to-orange-600/[0.02]",
    borderColor: "border-orange-500/20 hover:border-orange-400/50",
  },
]

const STAGGER = [
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

function TiltCard({ action, index }: { action: ActionCard; index: number }) {
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
        "will-change-transform overflow-hidden",
        action.cardGradient,
        action.borderColor,
        STAGGER[index] ?? "animate-slide-up-d4",
      )}
      style={{ "--glow-color": action.glowColor } as React.CSSProperties}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Spotlight glow overlay */}
      <span className="spotlight-overlay pointer-events-none absolute inset-0 rounded-2xl" />

      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={cn("relative rounded-xl p-2.5", action.iconBg)}>
          {/* Pulsing ring behind icon */}
          <span className={cn("icon-ring absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100", action.ringColor)} />
          <Icon className={cn("relative z-10 h-5 w-5 transition-transform duration-300 group-hover:scale-110", action.iconColor)} />
        </div>
        {action.badge && (
          <span className="text-[15px] leading-none drop-shadow-sm" aria-label="India">
            {action.badge}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1">
        <p className="text-[13px] font-semibold leading-snug text-foreground">
          {action.label}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {action.description}
        </p>
      </div>

      {/* Animated arrow */}
      <ArrowRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-muted-foreground/25 transition-all duration-300 group-hover:text-muted-foreground/70 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
    </Link>
  )
}

export default function HomePage() {
  const { currentUser } = useRole()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = currentUser?.name?.split(" ")[0] ?? ""

  return (
    <div className="relative min-h-full overflow-hidden">

      {/* Ambient aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="animate-orb absolute -top-48 -left-48 h-[650px] w-[650px] rounded-full bg-primary/[0.045] blur-3xl" />
        <div className="animate-orb-delay absolute top-1/3 -right-48 h-[550px] w-[550px] rounded-full bg-violet-500/[0.04] blur-3xl" />
        <div className="animate-orb absolute -bottom-24 left-1/3 h-[450px] w-[450px] rounded-full bg-emerald-500/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-14">

        {/* Header */}
        <div className="mb-12 animate-slide-up-d0" data-tour="home-header">
          {/* Date pill */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 px-3 py-1 backdrop-blur-sm">
            <Zap className="h-3 w-3 text-primary/70" />
            <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground/70 uppercase">
              {format(new Date(), "EEEE, MMMM d")}
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight leading-tight animate-greeting">
            <span className="animate-shimmer-text">{greeting}</span>
            {firstName
              ? <span className="text-foreground">{`, ${firstName}`}</span>
              : null
            }
          </h1>
        </div>

        {/* Action grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-tour="home-actions">
          {actions.map((action, i) => (
            <TiltCard key={action.href} action={action} index={i} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-10 flex justify-center animate-slide-up-d8">
          <Link
            href="/app/dashboard"
            className="group inline-flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-5 py-2.5 text-sm text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-muted/60 hover:text-foreground hover:shadow-sm"
          >
            <LayoutDashboard className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            Open full Dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}
